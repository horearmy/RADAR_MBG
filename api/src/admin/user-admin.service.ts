import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AccountStatus, Prisma } from '@prisma/client';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { assertMfaEncryptionKey } from '../auth/auth.security.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateUserInvitationDto,
  AssignUserRoleDto,
  ListUsersDto,
  RevokeUserRoleDto,
  UpdateUserStatusDto,
} from './user-admin.dto.js';
import {
  assertCanAssignRole,
  assertCanResetMfa,
  assertGlobalRoleAssignment,
  assertNotLastGlobalAdmin,
  assertNotSelfDeactivation,
} from './user-admin-policy.js';

@Injectable()
export class UserAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? {
        OR: [
          { username: { contains: query.search, mode: 'insensitive' } },
          { displayName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        orderBy: [{ displayName: 'asc' }, { username: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          status: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          roles: {
            where: {
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
            },
            select: {
              id: true,
              organizationId: true,
              regionId: true,
              sppgId: true,
              effectiveFrom: true,
              effectiveUntil: true,
              role: { select: { code: true, name: true, isGlobal: true, requiresMfa: true } },
            },
          },
        },
      }),
      this.prisma.db.user.count({ where }),
    ]);
    return {
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async createInvitation(
    actor: SessionPrincipal,
    input: CreateUserInvitationDto,
    requestId: string,
  ) {
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const passwordHash = await argon2.hash(randomBytes(32).toString('base64url'));
    try {
      const result = await this.prisma.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: input.username.trim().toLowerCase(),
            email: input.email?.trim().toLowerCase() ?? null,
            displayName: input.displayName.trim(),
            passwordHash,
            status: AccountStatus.INVITED,
          },
          select: { id: true, username: true, email: true, displayName: true, status: true },
        });
        const token = await this.issueAccountToken(tx, user.id, actor.id, 'INVITATION', rawToken, expiresAt);
        await this.writeAudit(tx, actor.id, 'user.invitation.create', 'user', user.id, input.reason.trim(),
          null, { username: user.username, email: user.email, status: user.status, tokenId: token.id, expiresAt: expiresAt.toISOString() }, requestId);
        return { user, expiresAt };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { ...result, token: rawToken };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'USER_USERNAME_OR_EMAIL_EXISTS' });
      }
      throw error;
    }
  }

  async createPasswordReset(
    actor: SessionPrincipal,
    userId: string,
    reason: string,
    requestId: string,
  ) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, status: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.status !== AccountStatus.ACTIVE) {
      throw new ConflictException({ code: 'USER_NOT_ACTIVE_FOR_PASSWORD_RESET' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const issued = await this.prisma.db.$transaction(async (tx) => {
      const token = await this.issueAccountToken(tx, userId, actor.id, 'PASSWORD_RESET', rawToken, expiresAt);
      await this.writeAudit(tx, actor.id, 'user.password.reset.issue', 'user', userId, reason.trim(),
        null, { tokenId: token.id, expiresAt: expiresAt.toISOString() }, requestId);
      return token;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { user: { id: user.id, username: user.username }, token: rawToken, expiresAt: issued.expiresAt };
  }

  async resetUserMfa(
    actor: SessionPrincipal,
    userId: string,
    reason: string,
    requestId: string,
  ) {
    assertCanResetMfa(actor.id, userId, actor.mfaEnabled);
    try {
      assertMfaEncryptionKey(process.env.MFA_ENCRYPTION_KEY);
    } catch {
      throw new ConflictException({ code: 'MFA_UNAVAILABLE' });
    }
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, status: true, mfaEnabled: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.status !== AccountStatus.ACTIVE || !user.mfaEnabled) {
      throw new ConflictException({ code: 'USER_MFA_NOT_ACTIVE' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, status: AccountStatus.ACTIVE, mfaEnabled: true },
        data: {
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          mfaPendingSecretEncrypted: null,
          mfaPendingExpiresAt: null,
        },
      });
      if (updated.count !== 1) throw new ConflictException({ code: 'USER_MFA_NOT_ACTIVE' });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      const revoked = await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const token = await this.issueAccountToken(tx, userId, actor.id, 'MFA_RESET', rawToken, expiresAt);
      await this.writeAudit(tx, actor.id, 'user.mfa.reset.issue', 'user', userId, reason.trim(),
        { mfaEnabled: true }, { mfaEnabled: false, revokedSessionCount: revoked.count, tokenId: token.id, expiresAt: expiresAt.toISOString() }, requestId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { user: { id: user.id, username: user.username }, token: rawToken, expiresAt };
  }

  async resendInvitation(
    actor: SessionPrincipal,
    userId: string,
    reason: string,
    requestId: string,
  ) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, status: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.status !== AccountStatus.INVITED) {
      throw new ConflictException({ code: 'USER_NOT_INVITED' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const issued = await this.prisma.db.$transaction(async (tx) => {
      const token = await this.issueAccountToken(tx, userId, actor.id, 'INVITATION', rawToken, expiresAt);
      await this.writeAudit(tx, actor.id, 'user.invitation.resend', 'user', userId, reason.trim(),
        null, { tokenId: token.id, expiresAt: expiresAt.toISOString() }, requestId);
      return token;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { user: { id: user.id, username: user.username }, token: rawToken, expiresAt: issued.expiresAt };
  }

  private async issueAccountToken(
    tx: Prisma.TransactionClient,
    userId: string,
    createdBy: string,
    purpose: 'INVITATION' | 'PASSWORD_RESET' | 'MFA_RESET',
    rawToken: string,
    expiresAt: Date,
  ) {
    await tx.accountAccessToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return tx.accountAccessToken.create({
      data: {
        userId,
        createdBy,
        purpose,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        expiresAt,
      },
    });
  }

  listRoles() {
    return this.prisma.db.role.findMany({
      where: { active: true },
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isGlobal: true,
        requiresMfa: true,
        permissions: {
          select: { permission: { select: { code: true, description: true } } },
          orderBy: { permission: { code: 'asc' } },
        },
      },
    });
  }

  async updateStatus(
    actor: SessionPrincipal,
    userId: string,
    input: UpdateUserStatusDto,
    requestId: string,
  ) {
    if (input.status === AccountStatus.INVITED) {
      throw new ConflictException({ code: 'USER_STATUS_TRANSITION_INVALID' });
    }
    assertNotSelfDeactivation(actor.id, userId, input.status === AccountStatus.ACTIVE);

    return this.prisma.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            where: {
              role: { isGlobal: true, active: true },
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
            },
            include: { role: true },
          },
        },
      });
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
      if (user.status === input.status) throw new ConflictException({ code: 'USER_STATUS_UNCHANGED' });

      if (user.status === AccountStatus.ACTIVE && input.status !== AccountStatus.ACTIVE && user.roles.length) {
        const activeGlobalAssignments = await tx.userRole.findMany({
          where: {
            role: { isGlobal: true, active: true },
            user: { status: AccountStatus.ACTIVE },
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
          },
          select: { userId: true },
          distinct: ['userId'],
        });
        assertNotLastGlobalAdmin(true, activeGlobalAssignments.length);
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: input.status,
          disabledAt: input.status === AccountStatus.ACTIVE ? null : new Date(),
        },
        select: { id: true, username: true, displayName: true, status: true, mfaEnabled: true },
      });
      const revoked = await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.writeAudit(tx, actor.id, 'user.status.update', 'user', userId, input.reason.trim(),
        { status: user.status }, { status: updated.status, revokedSessionCount: revoked.count }, requestId);
      return { user: updated, revokedSessionCount: revoked.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revokeSessions(
    actor: SessionPrincipal,
    userId: string,
    reason: string,
    requestId: string,
  ) {
    return this.prisma.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true },
      });
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
      const result = await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.writeAudit(tx, actor.id, 'user.sessions.revoke', 'user', userId, reason.trim(),
        null, { revokedSessionCount: result.count }, requestId);
      return { user, revokedSessionCount: result.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assignRole(
    actor: SessionPrincipal,
    userId: string,
    input: AssignUserRoleDto,
    requestId: string,
  ) {
    const scopeCount = [input.organizationId, input.regionId, input.sppgId].filter(Boolean).length;
    return this.prisma.db.$transaction(async (tx) => {
      const [user, role] = await Promise.all([
        tx.user.findUnique({ where: { id: userId } }),
        tx.role.findUnique({ where: { code: input.roleCode.trim().toUpperCase() }, include: { permissions: { include: { permission: true } } } }),
      ]);
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
      if (!role || !role.active) throw new NotFoundException({ code: 'ROLE_NOT_FOUND' });
      assertGlobalRoleAssignment(actor.roles.some((assignment) => assignment.isGlobal), role.isGlobal);
      assertCanAssignRole({
        isGlobal: role.isGlobal,
        requiresMfa: role.requiresMfa,
        mfaEnabled: user.mfaEnabled,
        scopeCount,
      });

      if (input.organizationId) {
        const exists = await tx.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
        if (!exists) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });
      }
      if (input.regionId) {
        const region = await tx.region.findUnique({ where: { id: input.regionId }, select: { id: true, organizationId: true } });
        if (!region) throw new NotFoundException({ code: 'REGION_NOT_FOUND' });
      }
      if (input.sppgId) {
        const sppg = await tx.sppg.findUnique({ where: { id: input.sppgId }, select: { id: true, organizationId: true } });
        if (!sppg) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
      }

      const now = new Date();
      const duplicate = await tx.userRole.findFirst({
        where: {
          userId,
          roleId: role.id,
          organizationId: input.organizationId ?? null,
          regionId: input.regionId ?? null,
          sppgId: input.sppgId ?? null,
          effectiveFrom: { lte: now },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
        },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException({ code: 'ROLE_ALREADY_ASSIGNED' });

      const assignment = await tx.userRole.create({
        data: {
          userId,
          roleId: role.id,
          organizationId: input.organizationId ?? null,
          regionId: input.regionId ?? null,
          sppgId: input.sppgId ?? null,
          assignedBy: actor.id,
        },
        select: {
          id: true,
          organizationId: true,
          regionId: true,
          sppgId: true,
          effectiveFrom: true,
          role: { select: { code: true, name: true, isGlobal: true, requiresMfa: true } },
        },
      });
      const revoked = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await this.writeAudit(tx, actor.id, 'user.role.assign', 'user', userId, input.reason.trim(),
        null, { roleCode: role.code, assignmentId: assignment.id, organizationId: assignment.organizationId,
          regionId: assignment.regionId, sppgId: assignment.sppgId, revokedSessionCount: revoked.count }, requestId);
      return { assignment, revokedSessionCount: revoked.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revokeRole(
    actor: SessionPrincipal,
    userId: string,
    input: RevokeUserRoleDto,
    requestId: string,
  ) {
    return this.prisma.db.$transaction(async (tx) => {
      const assignment = await tx.userRole.findFirst({
        where: {
          id: input.userRoleId,
          userId,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
        },
        include: { role: true, user: { select: { status: true } } },
      });
      if (!assignment) throw new NotFoundException({ code: 'USER_ROLE_NOT_FOUND' });
      if (assignment.role.isGlobal && assignment.user.status === AccountStatus.ACTIVE) {
        const globalCount = await tx.userRole.findMany({
          where: {
            role: { isGlobal: true, active: true },
            user: { status: AccountStatus.ACTIVE },
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
          },
          select: { userId: true },
          distinct: ['userId'],
        });
        assertNotLastGlobalAdmin(true, globalCount.length);
      }
      const now = new Date();
      const updated = await tx.userRole.update({ where: { id: assignment.id }, data: { effectiveUntil: now } });
      const revoked = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await this.writeAudit(tx, actor.id, 'user.role.revoke', 'user', userId, input.reason.trim(),
        { roleCode: assignment.role.code, effectiveUntil: assignment.effectiveUntil },
        { roleCode: assignment.role.code, effectiveUntil: updated.effectiveUntil, revokedSessionCount: revoked.count }, requestId);
      return { assignment: updated, revokedSessionCount: revoked.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    before: Prisma.InputJsonValue | null,
    after: Prisma.InputJsonValue,
    requestId: string,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType,
        entityId,
        result: 'success',
        reason,
        before: before ?? Prisma.JsonNull,
        after,
        requestId,
      },
    });
  }
}
