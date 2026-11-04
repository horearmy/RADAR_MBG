import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AccountStatus, MembershipStatus, Prisma } from '@prisma/client';
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

  async listUsers(actor: SessionPrincipal, query: ListUsersDto) {
    const where: Prisma.UserWhereInput = {
      ...(await this.userScopeWhere(actor)),
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
        if (actor.tenantId) {
          await tx.tenantMembership.create({
            data: {
              tenantId: actor.tenantId,
              userId: user.id,
              role: 'TENANT_OPERATOR',
              status: 'INVITED',
              invitedByUserId: actor.id,
            },
          });
        }
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
    const user = await this.prisma.db.user.findFirst({
      where: { id: userId, ...(await this.userScopeWhere(actor)) },
      select: { id: true, username: true, status: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.status !== AccountStatus.ACTIVE) {
      throw new ConflictException({ code: 'USER_NOT_ACTIVE_FOR_PASSWORD_RESET' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const issued = await this.prisma.db.$transaction(async (tx) => {
      await this.assertUserInScope(actor, userId, tx);
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
    const user = await this.prisma.db.user.findFirst({
      where: { id: userId, ...(await this.userScopeWhere(actor)) },
      select: { id: true, username: true, status: true, mfaEnabled: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.status !== AccountStatus.ACTIVE || !user.mfaEnabled) {
      throw new ConflictException({ code: 'USER_MFA_NOT_ACTIVE' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.db.$transaction(async (tx) => {
      await this.assertUserInScope(actor, userId, tx);
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
    const user = await this.prisma.db.user.findFirst({
      where: { id: userId, ...(await this.userScopeWhere(actor)) },
      select: { id: true, username: true, status: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (user.status !== AccountStatus.INVITED) {
      throw new ConflictException({ code: 'USER_NOT_INVITED' });
    }
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const issued = await this.prisma.db.$transaction(async (tx) => {
      await this.assertUserInScope(actor, userId, tx);
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
      await this.assertUserInScope(actor, userId, tx);
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
      await this.assertUserInScope(actor, userId, tx);
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
      await this.assertUserInScope(actor, userId, tx);
      assertGlobalRoleAssignment(actor.roles.some((assignment) => assignment.isGlobal), role.isGlobal);
      assertCanAssignRole({
        isGlobal: role.isGlobal,
        requiresMfa: role.requiresMfa,
        mfaEnabled: user.mfaEnabled,
        scopeCount,
      });

      const organizationId = input.organizationId ?? null;
      const regionId = input.regionId ?? null;
      const sppgId = input.sppgId ?? null;
      let targetOrganizationId = organizationId;
      let targetRegionId = regionId;
      if (sppgId) {
        const sppg = await tx.sppg.findUnique({ where: { id: sppgId }, select: { id: true, organizationId: true, regionId: true } });
        if (!sppg) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
        if ((organizationId && organizationId !== sppg.organizationId) || (regionId && regionId !== sppg.regionId)) {
          throw new ConflictException({ code: 'ROLE_SCOPE_HIERARCHY_INVALID' });
        }
        targetOrganizationId = sppg.organizationId;
        targetRegionId = sppg.regionId;
      }
      if (regionId) {
        const region = await tx.region.findUnique({ where: { id: regionId }, select: { id: true, organizationId: true } });
        if (!region) throw new NotFoundException({ code: 'REGION_NOT_FOUND' });
        if (organizationId && organizationId !== region.organizationId) {
          throw new ConflictException({ code: 'ROLE_SCOPE_HIERARCHY_INVALID' });
        }
        targetOrganizationId = region.organizationId;
      }
      if (organizationId) {
        const exists = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
        if (!exists) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });
      }
      await this.assertAssignableScope(actor, { organizationId: targetOrganizationId, regionId: targetRegionId, sppgId }, tx);

      const now = new Date();
      const duplicate = await tx.userRole.findFirst({
        where: {
          userId,
          roleId: role.id,
          organizationId,
          regionId,
          sppgId,
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
      await this.assertUserInScope(actor, userId, tx);
      if (!assignment) throw new NotFoundException({ code: 'USER_ROLE_NOT_FOUND' });
      await this.assertAssignableScope(actor, assignment, tx);
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

  private async userScopeWhere(actor: SessionPrincipal): Promise<Prisma.UserWhereInput> {
    if (actor.roles.some((role) => role.isGlobal)) return {};
    const membershipTenantIds = actor.tenantId ? [actor.tenantId] : [];
    const organizationIds = [...new Set(actor.roles.flatMap((role) => role.organizationId ? [role.organizationId] : []))];
    const regionIds = [...new Set(actor.roles.flatMap((role) => role.regionId ? [role.regionId] : []))];
    const sppgIds = [...new Set(actor.roles.flatMap((role) => role.sppgId ? [role.sppgId] : []))];
    const OR: Prisma.UserWhereInput[] = [
      ...(membershipTenantIds.length ? [{ tenantMemberships: { some: { tenantId: { in: membershipTenantIds }, status: { in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED] } } } }] : []),
      ...(organizationIds.length || regionIds.length || sppgIds.length ? [{ roles: { some: {
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
        AND: [{ OR: [
          ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
          ...(regionIds.length ? [{ regionId: { in: regionIds } }] : []),
          ...(sppgIds.length ? [{ sppgId: { in: sppgIds } }] : []),
        ] }],
      } } }] : []),
    ];
    return OR.length ? { OR } : { id: actor.id };
  }

  private async assertUserInScope(actor: SessionPrincipal, userId: string, tx?: Prisma.TransactionClient) {
    if (actor.roles.some((role) => role.isGlobal)) return;
    const where = await this.userScopeWhere(actor);
    const client = tx ?? this.prisma.db;
    const target = await client.user.findFirst({ where: { AND: [{ id: userId }, where] }, select: { id: true } });
    if (!target) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
  }

  private async assertAssignableScope(
    actor: SessionPrincipal,
    scope: { organizationId?: string | null; regionId?: string | null; sppgId?: string | null },
    tx?: Prisma.TransactionClient,
  ) {
    if (actor.roles.some((role) => role.isGlobal)) return;
    const client = tx ?? this.prisma.db;
    let organizationId = scope.organizationId ?? null;
    let regionId = scope.regionId ?? null;
    if (scope.sppgId && (!organizationId || !regionId)) {
      const sppg = await client.sppg.findUnique({
        where: { id: scope.sppgId },
        select: { organizationId: true, regionId: true },
      });
      if (sppg) {
        organizationId ??= sppg.organizationId;
        regionId ??= sppg.regionId;
      }
    }
    if (regionId && !organizationId) {
      const region = await client.region.findUnique({ where: { id: regionId }, select: { organizationId: true } });
      organizationId = region?.organizationId ?? null;
    }
    const allowed = actor.roles.some((role) =>
      (role.organizationId && role.organizationId === organizationId) ||
      (role.regionId && role.regionId === regionId) ||
      (role.sppgId && role.sppgId === scope.sppgId),
    );
    if (allowed) return;
    if (actor.tenantId && scope.sppgId) {
      const tenant = await client.tenant.findFirst({ where: { id: actor.tenantId, legacySppgId: scope.sppgId, status: 'ACTIVE' }, select: { id: true } });
      if (tenant) return;
    }
    throw new NotFoundException({ code: 'USER_SCOPE_NOT_FOUND' });
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
