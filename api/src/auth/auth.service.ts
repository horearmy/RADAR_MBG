import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../database/prisma.service.js';
import { CacheService } from '../cache/cache.service.js';
import { isAccountTokenUsable } from './account-token-policy.js';
import { DistributedLoginRateLimiter } from './login-rate-limiter.js';
import {
  createTotpProvisioningUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaRecoveryCodes,
  generateTotpSecret,
  hashMfaRecoveryCode,
  verifyDoubleSubmitCsrf,
  verifyTotp,
} from './auth.security.js';

const SESSION_COOKIE = 'radar_session';
const CSRF_COOKIE = 'radar_csrf';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_MFA_ENROLLMENT_ATTEMPTS = 10;
const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,p=4,t=3$AXprwskT4HWNnTBr3+GTpA$Bv/eqMS+1V+9gnFHW/dIXm/8ZR+C9HpBJPZ2IM4ax2M';

type LoginBucket = { count: number; resetAt: number };

export type SessionPrincipal = {
  id: string;
  username: string;
  displayName: string;
  mfaEnabled: boolean;
  driverId: string | null;
  tenantRole?: string | null;
  tenantId?: string | null;
  tenantMemberships?: Array<{
    tenantId: string;
    tenantCode: string;
    tenantName: string;
    role: string;
  }>;
  hasTenantMemberships?: boolean;
  features?: Record<string, boolean> | null;
  roles: Array<{
    code: string;
    isGlobal: boolean;
    organizationId: string | null;
    regionId: string | null;
    sppgId: string | null;
    permissions: string[];
  }>;
};

@Injectable()
export class AuthService {
  private readonly loginRateLimiter: DistributedLoginRateLimiter;
  private readonly mfaEnrollmentBuckets = new Map<string, LoginBucket>();

  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {
    const loginRateLimit = Number(process.env.LOGIN_RATE_LIMIT ?? 10);
    const loginWindowMs = Number(process.env.LOGIN_RATE_WINDOW_MS ?? LOGIN_WINDOW_MS);
    this.loginRateLimiter = new DistributedLoginRateLimiter(prisma, loginRateLimit, loginWindowMs);
  }

  issueCsrfCookie(response: Response): { csrfToken: string } {
    const csrfToken = randomBytes(32).toString('hex');
    response.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
    return { csrfToken };
  }

  async login(
    request: Request,
    response: Response,
    input: { username: string; password: string; otpCode?: string; recoveryCode?: string },
  ) {
    this.assertCsrf(request);
    const clientIp = this.getClientIp(request) ?? 'unknown';
    try {
      await this.assertLoginRateLimit(input.username, clientIp);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        await this.writeAuthenticationAudit(request, 'auth.login.denied', null, {
          stage: 'rate_limited',
        });
      }
      throw error;
    }

    const username = input.username.trim().toLowerCase();
    const user = await this.prisma.db.user.findUnique({
      where: { username },
      include: {
        driver: { select: { id: true } },
        roles: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
            role: { active: true },
          },
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    const passwordValid = await this.verifyPassword(
      user?.passwordHash,
      input.password,
    );

    if (!user || !passwordValid || user.status !== AccountStatus.ACTIVE) {
      await this.writeAuthenticationAudit(request, 'auth.login.failed', user?.id ?? null, {
        stage: 'credentials',
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Username atau kata sandi tidak valid.',
      });
    }

    const requiresMfa = user.roles.some(
      ({ role }) => role.isGlobal || role.requiresMfa,
    );
    if (requiresMfa && !user.mfaEnabled) {
      await this.writeAuthenticationAudit(request, 'auth.login.denied', user.id, {
        stage: 'mfa_setup_required',
      });
      throw new ForbiddenException({
        code: 'MFA_SETUP_REQUIRED',
        message: 'Akun memerlukan penyiapan autentikasi multifaktor.',
      });
    }

    let recoveryCodeId: string | null = null;
    if (user.mfaEnabled && input.otpCode) {
      try {
        this.assertTotp(user.mfaSecretEncrypted, input.otpCode);
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          await this.writeAuthenticationAudit(request, 'auth.login.failed', user.id, {
            stage: 'mfa',
          });
        }
        throw error;
      }
    } else if (user.mfaEnabled && input.recoveryCode) {
      const recoveryCode = await this.prisma.db.mfaRecoveryCode.findFirst({
        where: { userId: user.id, tokenHash: hashMfaRecoveryCode(input.recoveryCode), usedAt: null },
        select: { id: true },
      });
      if (!recoveryCode) {
        await this.writeAuthenticationAudit(request, 'auth.login.failed', user.id, {
          stage: 'mfa_recovery',
        });
        throw new UnauthorizedException({ code: 'MFA_RECOVERY_CODE_INVALID' });
      }
      recoveryCodeId = recoveryCode.id;
    } else if (user.mfaEnabled) {
      await this.writeAuthenticationAudit(request, 'auth.login.failed', user.id, {
        stage: 'mfa',
      });
      throw new UnauthorizedException({ code: 'MFA_REQUIRED' });
    }

    await this.clearLoginRateLimit(username, clientIp);

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await this.prisma.db.$transaction(async (tx) => {
      if (recoveryCodeId) {
        const consumed = await tx.mfaRecoveryCode.updateMany({
          where: { id: recoveryCodeId, userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (consumed.count !== 1) {
          throw new UnauthorizedException({ code: 'MFA_RECOVERY_CODE_INVALID' });
        }
      }
      const createdSession = await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt,
          ipAddress: this.getClientIp(request),
          userAgent: request.get('user-agent')?.slice(0, 500),
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'auth.login.succeeded',
          entityType: 'session',
          entityId: createdSession.id,
          result: 'success',
          after: {
            expiresAt: expiresAt.toISOString(),
            mfaUsed: user.mfaEnabled,
            mfaRecoveryCodeUsed: recoveryCodeId !== null,
          },
          requestId: randomUUID(),
          ipAddress: this.getClientIp(request),
        },
      });
      return createdSession;
    }).catch(async (error: unknown) => {
      if (recoveryCodeId && error instanceof UnauthorizedException) {
        await this.writeAuthenticationAudit(request, 'auth.login.failed', user.id, {
          stage: 'mfa_recovery',
        });
      }
      throw error;
    });

    response.cookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });

    return {
      success: true,
      sessionId: session.id,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async logout(request: Request, response: Response) {
    this.assertCsrf(request);
    const rawToken = request.cookies?.[SESSION_COOKIE];
    if (rawToken) await this.cache.del(`session:principal:${this.hashToken(rawToken)}`);
    const session = rawToken
      ? await this.prisma.db.session.findUnique({
          where: { tokenHash: this.hashToken(rawToken) },
          select: { id: true, userId: true },
        })
      : null;

    await this.prisma.db.$transaction(async (tx) => {
      if (session) {
        await tx.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: session?.userId ?? null,
          action: 'auth.logout',
          entityType: 'session',
          entityId: session?.id ?? null,
          result: 'success',
          requestId: randomUUID(),
          ipAddress: this.getClientIp(request),
        },
      });
    });

    response.clearCookie(SESSION_COOKIE, { path: '/' });
    response.clearCookie(CSRF_COOKIE, { path: '/' });
    return { success: true };
  }

  async resolveSession(rawToken?: string): Promise<SessionPrincipal | null> {
    if (!rawToken) return null;
    const tokenHash = this.hashToken(rawToken);
    const cacheKey = `session:principal:${tokenHash}`;
    const cached = await this.cache.get<SessionPrincipal>(cacheKey);
    if (cached) return cached;

    const session = await this.prisma.db.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            driver: { select: { id: true } },
            tenantMemberships: {
              include: { tenant: { select: { id: true, tenantCode: true, name: true, status: true } } },
              orderBy: { createdAt: 'asc' },
            },
            roles: {
              where: {
                effectiveFrom: { lte: new Date() },
                OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
                role: { active: true },
              },
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== AccountStatus.ACTIVE
    ) {
      return null;
    }

    const principal: SessionPrincipal = {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      mfaEnabled: session.user.mfaEnabled,
      driverId: session.user.driver?.id ?? null,
      features: session.user.features as Record<string, boolean> | null,
      hasTenantMemberships: session.user.tenantMemberships.length > 0,
      tenantMemberships: session.user.tenantMemberships
        .filter((membership) => membership.status === 'ACTIVE' && membership.tenant.status === 'ACTIVE')
        .map((membership) => ({
        tenantId: membership.tenant.id,
        tenantCode: membership.tenant.tenantCode,
        tenantName: membership.tenant.name,
        role: membership.role,
      })),
      roles: session.user.roles.map(({ role, organizationId, regionId, sppgId }) => ({
        code: role.code,
        isGlobal: role.isGlobal,
        organizationId,
        regionId,
        sppgId,
        permissions: role.permissions.map(({ permission }) => permission.code),
      })),
    };
    await this.cache.set(cacheKey, principal, 300);
    return principal;
  }

  async beginMfaEnrollment(principal: SessionPrincipal) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: principal.id },
      select: { username: true, email: true, mfaEnabled: true },
    });
    if (!user) throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    if (user.mfaEnabled) throw new ForbiddenException({ code: 'MFA_ALREADY_ENABLED' });
    const secret = generateTotpSecret();
    return {
      secret,
      provisioningUri: createTotpProvisioningUri(secret, user.email ?? user.username),
    };
  }

  async consumeAccountToken(
    request: Request,
    input: { token: string; password: string },
    requestId: string,
  ) {
    await this.assertLoginRateLimit('account-access', this.getClientIp(request) ?? 'unknown');
    const tokenHash = this.hashToken(input.token);
    const accountToken = await this.prisma.db.accountAccessToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, username: true, status: true } } },
    });
    const now = new Date();
    if (!accountToken || !isAccountTokenUsable({
      purpose: accountToken.purpose,
      accountStatus: accountToken.user.status,
      expiresAt: accountToken.expiresAt,
      consumedAt: accountToken.consumedAt,
      now,
    })) {
      throw new UnauthorizedException({ code: 'ACCOUNT_TOKEN_INVALID_OR_EXPIRED' });
    }

    const passwordHash = await argon2.hash(input.password);
    return this.prisma.db.$transaction(async (tx) => {
      const consumed = await tx.accountAccessToken.updateMany({
        where: { id: accountToken.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException({ code: 'ACCOUNT_TOKEN_INVALID_OR_EXPIRED' });
      }
      const isInvitation = accountToken.purpose === 'INVITATION';
      const updated = await tx.user.updateMany({
        where: {
          id: accountToken.userId,
          status: isInvitation ? AccountStatus.INVITED : AccountStatus.ACTIVE,
        },
        data: {
          passwordHash,
          passwordChangedAt: now,
          ...(isInvitation ? { status: AccountStatus.ACTIVE, disabledAt: null } : {}),
        },
      });
      if (updated.count !== 1) {
        throw new UnauthorizedException({ code: 'ACCOUNT_TOKEN_INVALID_OR_EXPIRED' });
      }
      if (isInvitation) {
        await tx.tenantMembership.updateMany({
          where: { userId: accountToken.userId, status: 'INVITED' },
          data: { status: 'ACTIVE' },
        });
        await tx.recipientMembership.updateMany({
          where: { userId: accountToken.userId, status: 'INVITED' },
          data: { status: 'ACTIVE' },
        });
      }
      const revoked = await tx.session.updateMany({
        where: { userId: accountToken.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: accountToken.userId,
          action: isInvitation ? 'user.invitation.accept' : 'user.password.reset.complete',
          entityType: 'user',
          entityId: accountToken.userId,
          result: 'success',
          reason: isInvitation ? 'Pengguna menerima undangan dan menetapkan password.' : 'Password direset menggunakan token sekali pakai.',
          before: { status: accountToken.user.status },
          after: {
            status: isInvitation ? AccountStatus.ACTIVE : accountToken.user.status,
            passwordChanged: true,
            revokedSessionCount: revoked.count,
          },
          requestId,
          ipAddress: this.getClientIp(request),
        },
      });
      return {
        success: true,
        purpose: accountToken.purpose,
        username: accountToken.user.username,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async confirmMfaEnrollment(
    principal: SessionPrincipal,
    input: { secret: string; otpCode: string },
  ) {
    this.assertMfaEnrollmentRateLimit(principal.id);
    const user = await this.prisma.db.user.findUnique({
      where: { id: principal.id },
      select: { status: true, mfaEnabled: true },
    });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    }
    if (user.mfaEnabled) throw new ForbiddenException({ code: 'MFA_ALREADY_ENABLED' });
    if (!verifyTotp(input.secret, input.otpCode)) {
      this.recordMfaEnrollmentFailure(principal.id);
      throw new UnauthorizedException({ code: 'MFA_INVALID' });
    }
    const encryptionKey = process.env.MFA_ENCRYPTION_KEY;
    if (!encryptionKey) throw new ForbiddenException({ code: 'MFA_UNAVAILABLE' });
    const encryptedSecret = encryptMfaSecret(input.secret, encryptionKey);
    const recoveryCodes = generateMfaRecoveryCodes();
    return this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: principal.id, status: AccountStatus.ACTIVE, mfaEnabled: false },
        data: {
          mfaSecretEncrypted: encryptedSecret,
          mfaEnabled: true,
          mfaPendingSecretEncrypted: null,
          mfaPendingExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new ForbiddenException({ code: 'MFA_ALREADY_ENABLED_OR_ACCOUNT_INACTIVE' });
      }
      await this.replaceMfaRecoveryCodes(tx, principal.id, recoveryCodes.hashes);
      this.mfaEnrollmentBuckets.delete(principal.id);
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'security.mfa.enable',
          entityType: 'user',
          entityId: principal.id,
          result: 'success',
          reason: 'Pengguna menyelesaikan enrollment MFA.',
          before: { mfaEnabled: false },
          after: { mfaEnabled: true },
        },
      });
      return { success: true, mfaEnabled: true, recoveryCodes: recoveryCodes.codes };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async beginMfaRotation(
    principal: SessionPrincipal,
    input: { otpCode?: string; recoveryCode?: string },
  ) {
    this.assertMfaEnrollmentRateLimit(principal.id);
    const user = await this.prisma.db.user.findUnique({
      where: { id: principal.id },
      select: { status: true, mfaEnabled: true, mfaSecretEncrypted: true },
    });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    }
    if (!user.mfaEnabled) throw new ForbiddenException({ code: 'MFA_NOT_ENABLED' });
    if (Boolean(input.otpCode) === Boolean(input.recoveryCode)) {
      throw new UnauthorizedException({ code: 'MFA_FACTOR_REQUIRED' });
    }

    const recoveryCode = input.recoveryCode
      ? await this.prisma.db.mfaRecoveryCode.findFirst({
          where: { userId: principal.id, tokenHash: hashMfaRecoveryCode(input.recoveryCode), usedAt: null },
          select: { id: true },
        })
      : null;
    if (input.recoveryCode && !recoveryCode) {
      this.recordMfaEnrollmentFailure(principal.id);
      throw new UnauthorizedException({ code: 'MFA_RECOVERY_CODE_INVALID' });
    }
    if (input.otpCode) {
      try {
        this.assertTotp(user.mfaSecretEncrypted, input.otpCode);
      } catch (error) {
        if (error instanceof UnauthorizedException) this.recordMfaEnrollmentFailure(principal.id);
        throw error;
      }
    }

    const key = process.env.MFA_ENCRYPTION_KEY;
    if (!key) throw new ForbiddenException({ code: 'MFA_UNAVAILABLE' });
    const secret = generateTotpSecret();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const pendingSecret = encryptMfaSecret(secret, key);
    await this.prisma.db.$transaction(async (tx) => {
      if (recoveryCode) {
        const consumed = await tx.mfaRecoveryCode.updateMany({
          where: { id: recoveryCode.id, userId: principal.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (consumed.count !== 1) {
          throw new UnauthorizedException({ code: 'MFA_RECOVERY_CODE_INVALID' });
        }
      }
      const updated = await tx.user.updateMany({
        where: { id: principal.id, status: AccountStatus.ACTIVE, mfaEnabled: true },
        data: { mfaPendingSecretEncrypted: pendingSecret, mfaPendingExpiresAt: expiresAt },
      });
      if (updated.count !== 1) throw new ForbiddenException({ code: 'MFA_NOT_ENABLED' });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'security.mfa.rotation.begin',
          entityType: 'user',
          entityId: principal.id,
          result: 'success',
          reason: 'Pengguna memulai rotasi MFA setelah verifikasi faktor aktif.',
          after: { pendingExpiresAt: expiresAt.toISOString(), recoveryCodeUsed: Boolean(recoveryCode) },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return {
      secret,
      provisioningUri: createTotpProvisioningUri(secret, principal.username),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmMfaRotation(principal: SessionPrincipal, otpCode: string) {
    this.assertMfaEnrollmentRateLimit(principal.id);
    const key = process.env.MFA_ENCRYPTION_KEY;
    if (!key) throw new ForbiddenException({ code: 'MFA_UNAVAILABLE' });
    const user = await this.prisma.db.user.findUnique({
      where: { id: principal.id },
      select: {
        status: true,
        mfaEnabled: true,
        mfaPendingSecretEncrypted: true,
        mfaPendingExpiresAt: true,
      },
    });
    const now = new Date();
    if (!user || user.status !== AccountStatus.ACTIVE || !user.mfaEnabled ||
      !user.mfaPendingSecretEncrypted || !user.mfaPendingExpiresAt || user.mfaPendingExpiresAt <= now) {
      throw new UnauthorizedException({ code: 'MFA_ROTATION_NOT_PENDING' });
    }
    const nextSecret = decryptMfaSecret(user.mfaPendingSecretEncrypted, key);
    if (!verifyTotp(nextSecret, otpCode)) {
      this.recordMfaEnrollmentFailure(principal.id);
      throw new UnauthorizedException({ code: 'MFA_INVALID' });
    }
    const encryptedSecret = user.mfaPendingSecretEncrypted;
    const recoveryCodes = generateMfaRecoveryCodes();
    return this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: {
          id: principal.id,
          status: AccountStatus.ACTIVE,
          mfaEnabled: true,
          mfaPendingExpiresAt: { gt: now },
        },
        data: {
          mfaSecretEncrypted: encryptedSecret,
          mfaPendingSecretEncrypted: null,
          mfaPendingExpiresAt: null,
        },
      });
      if (updated.count !== 1) throw new UnauthorizedException({ code: 'MFA_ROTATION_NOT_PENDING' });
      await this.replaceMfaRecoveryCodes(tx, principal.id, recoveryCodes.hashes);
      const revoked = await tx.session.updateMany({
        where: { userId: principal.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.id,
          action: 'security.mfa.rotation.complete',
          entityType: 'user',
          entityId: principal.id,
          result: 'success',
          reason: 'Pengguna menyelesaikan rotasi MFA.',
          before: { mfaEnabled: true },
          after: { mfaEnabled: true, revokedSessionCount: revoked.count, recoveryCodeCount: recoveryCodes.codes.length },
        },
      });
      return { success: true, recoveryCodes: recoveryCodes.codes, sessionsRevoked: revoked.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async beginMfaRecovery(input: { token: string; password: string }, request: Request) {
    await this.assertLoginRateLimit(`mfa-recovery:${input.token}`, this.getClientIp(request) ?? 'unknown');
    const now = new Date();
    const resetToken = await this.prisma.db.accountAccessToken.findUnique({
      where: { tokenHash: this.hashToken(input.token) },
      include: { user: { select: { id: true, username: true, email: true, status: true, mfaEnabled: true, passwordHash: true } } },
    });
    if (!resetToken || resetToken.purpose !== 'MFA_RESET' || resetToken.consumedAt ||
      resetToken.expiresAt <= now || resetToken.user.status !== AccountStatus.ACTIVE ||
      resetToken.user.mfaEnabled || !(await this.verifyPassword(resetToken.user.passwordHash, input.password))) {
      throw new UnauthorizedException({ code: 'MFA_RECOVERY_INVALID_OR_EXPIRED' });
    }
    const key = process.env.MFA_ENCRYPTION_KEY;
    if (!key) throw new ForbiddenException({ code: 'MFA_UNAVAILABLE' });
    const secret = generateTotpSecret();
    const expiresAt = new Date(Math.min(resetToken.expiresAt.getTime(), Date.now() + 10 * 60 * 1000));
    const pendingSecret = encryptMfaSecret(secret, key);
    const updated = await this.prisma.db.user.updateMany({
      where: { id: resetToken.userId, status: AccountStatus.ACTIVE, mfaEnabled: false },
      data: { mfaPendingSecretEncrypted: pendingSecret, mfaPendingExpiresAt: expiresAt },
    });
    if (updated.count !== 1) throw new UnauthorizedException({ code: 'MFA_RECOVERY_INVALID_OR_EXPIRED' });
    return {
      secret,
      provisioningUri: createTotpProvisioningUri(secret, resetToken.user.email ?? resetToken.user.username),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmMfaRecovery(input: { token: string; password: string; otpCode: string }, requestId: string, request: Request) {
    await this.assertLoginRateLimit(`mfa-recovery:${input.token}`, this.getClientIp(request) ?? 'unknown');
    const now = new Date();
    const resetToken = await this.prisma.db.accountAccessToken.findUnique({
      where: { tokenHash: this.hashToken(input.token) },
      include: { user: { select: { id: true, username: true, status: true, mfaEnabled: true, passwordHash: true, mfaPendingSecretEncrypted: true, mfaPendingExpiresAt: true } } },
    });
    if (!resetToken || resetToken.purpose !== 'MFA_RESET' || resetToken.consumedAt ||
      resetToken.expiresAt <= now || resetToken.user.status !== AccountStatus.ACTIVE ||
      resetToken.user.mfaEnabled || !(await this.verifyPassword(resetToken.user.passwordHash, input.password)) ||
      !resetToken.user.mfaPendingSecretEncrypted || !resetToken.user.mfaPendingExpiresAt ||
      resetToken.user.mfaPendingExpiresAt <= now) {
      throw new UnauthorizedException({ code: 'MFA_RECOVERY_INVALID_OR_EXPIRED' });
    }
    const key = process.env.MFA_ENCRYPTION_KEY;
    if (!key) throw new ForbiddenException({ code: 'MFA_UNAVAILABLE' });
    const secret = decryptMfaSecret(resetToken.user.mfaPendingSecretEncrypted, key);
    if (!verifyTotp(secret, input.otpCode)) throw new UnauthorizedException({ code: 'MFA_INVALID' });
    const recoveryCodes = generateMfaRecoveryCodes();
    return this.prisma.db.$transaction(async (tx) => {
      const consumed = await tx.accountAccessToken.updateMany({
        where: { id: resetToken.id, purpose: 'MFA_RESET', consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new UnauthorizedException({ code: 'MFA_RECOVERY_INVALID_OR_EXPIRED' });
      const updated = await tx.user.updateMany({
        where: {
          id: resetToken.userId,
          status: AccountStatus.ACTIVE,
          mfaEnabled: false,
          mfaPendingExpiresAt: { gt: now },
        },
        data: {
          mfaEnabled: true,
          mfaSecretEncrypted: resetToken.user.mfaPendingSecretEncrypted,
          mfaPendingSecretEncrypted: null,
          mfaPendingExpiresAt: null,
        },
      });
      if (updated.count !== 1) throw new UnauthorizedException({ code: 'MFA_RECOVERY_INVALID_OR_EXPIRED' });
      await this.replaceMfaRecoveryCodes(tx, resetToken.userId, recoveryCodes.hashes);
      await tx.auditLog.create({
        data: {
          actorUserId: resetToken.userId,
          action: 'security.mfa.recovery.complete',
          entityType: 'user',
          entityId: resetToken.userId,
          result: 'success',
          reason: 'Pengguna menyelesaikan pemulihan MFA dengan token administrator, password, dan TOTP baru.',
          before: { mfaEnabled: false },
          after: { mfaEnabled: true, recoveryCodeCount: recoveryCodes.codes.length },
          requestId,
          ipAddress: this.getClientIp(request),
        },
      });
      return { success: true, recoveryCodes: recoveryCodes.codes, username: resetToken.user.username };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async replaceMfaRecoveryCodes(
    tx: Prisma.TransactionClient,
    userId: string,
    hashes: string[],
  ) {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({ data: hashes.map((tokenHash) => ({ userId, tokenHash })) });
  }

  private assertCsrf(request: Request) {
    const origin = request.get('origin');
    const allowedOrigins = (process.env.WEB_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((value) => value.trim());

    if (!origin || !allowedOrigins.includes(origin)) {
      throw new ForbiddenException({
        code: 'ORIGIN_INVALID',
        message: 'Asal permintaan tidak diizinkan.',
      });
    }

    if (
      !verifyDoubleSubmitCsrf(
        request.cookies?.[CSRF_COOKIE],
        request.get('x-csrf-token'),
      )
    ) {
      throw new ForbiddenException({
        code: 'CSRF_INVALID',
        message: 'Permintaan tidak dapat diverifikasi.',
      });
    }
  }

  private async assertLoginRateLimit(username: string, ip: string) {
    if (!await this.loginRateLimiter.allows(username, ip)) {
      throw new ForbiddenException({
        code: 'LOGIN_RATE_LIMITED',
        message: 'Terlalu banyak percobaan. Silakan coba kembali nanti.',
      });
    }
  }

  private assertMfaEnrollmentRateLimit(userId: string) {
    const bucket = this.mfaEnrollmentBuckets.get(userId);
    if (!bucket || bucket.resetAt <= Date.now()) {
      this.mfaEnrollmentBuckets.set(userId, { count: 0, resetAt: Date.now() + LOGIN_WINDOW_MS });
      return;
    }
    if (bucket.count >= MAX_MFA_ENROLLMENT_ATTEMPTS) {
      throw new ForbiddenException({ code: 'MFA_ENROLLMENT_RATE_LIMITED' });
    }
  }

  private recordMfaEnrollmentFailure(userId: string) {
    const bucket = this.mfaEnrollmentBuckets.get(userId);
    if (bucket && bucket.resetAt > Date.now()) {
      bucket.count += 1;
      return;
    }
    this.mfaEnrollmentBuckets.set(userId, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
  }

  private async verifyPassword(hash: string | undefined, password: string) {
    try {
      return await argon2.verify(hash ?? DUMMY_PASSWORD_HASH, password);
    } catch {
      return false;
    }
  }

  private async clearLoginRateLimit(username: string, ip: string) {
    await this.loginRateLimiter.clear(username, ip);
  }

  private assertTotp(encryptedSecret: string | null, code?: string) {
    if (!code || !encryptedSecret) {
      throw new UnauthorizedException({
        code: 'MFA_REQUIRED',
        message: 'Kode autentikasi multifaktor diperlukan.',
      });
    }

    const key = process.env.MFA_ENCRYPTION_KEY;
    if (!key) {
      throw new ForbiddenException({
        code: 'MFA_UNAVAILABLE',
        message: 'Autentikasi multifaktor belum tersedia.',
      });
    }

    try {
      const secret = decryptMfaSecret(encryptedSecret, key);
      if (verifyTotp(secret, code)) return;
    } catch {
      throw new ForbiddenException({
        code: 'MFA_UNAVAILABLE',
        message: 'Autentikasi multifaktor belum tersedia.',
      });
    }

    throw new UnauthorizedException({
      code: 'MFA_INVALID',
      message: 'Kode autentikasi multifaktor tidak valid.',
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private writeAuthenticationAudit(
    request: Request,
    action: string,
    actorUserId: string | null,
    details: { stage: 'credentials' | 'mfa' | 'mfa_setup_required' | 'rate_limited' | 'mfa_recovery' },
  ) {
    return this.prisma.db.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType: 'authentication',
        result: 'failure',
        after: details,
        requestId: randomUUID(),
        ipAddress: this.getClientIp(request),
      },
    });
  }

  private getClientIp(request: Request) {
    const ip = request.ip || request.socket.remoteAddress;
    return ip?.replace(/^::ffff:/, '') ?? null;
  }
}
