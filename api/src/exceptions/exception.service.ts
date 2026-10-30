import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
  Prisma,
} from '@prisma/client';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { canAccessExceptionScope } from './exception-access-policy.js';
import {
  AssignExceptionDto,
  CloseExceptionDto,
  CreateExceptionDto,
  EscalateExceptionDto,
  ExceptionCloseOutcome,
  InvestigateExceptionDto,
  ListExceptionAssigneesDto,
  ListExceptionsDto,
  ResolveExceptionDto,
  TriageExceptionDto,
} from './exception.dto.js';

type TransitionInput = { version: number; reason: string; note?: string };

type ExceptionScope = {
  global: boolean;
  organizationIds: string[];
  regionIds: string[];
  sppgIds: string[];
};

@Injectable()
export class ExceptionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: SessionPrincipal, query: ListExceptionsDto) {
    const conditions: Prisma.ExceptionCaseWhereInput[] = [this.scopeWhere(principal)];
    if (query.status) conditions.push({ status: query.status });
    if (query.severity) conditions.push({ severity: query.severity });
    if (query.source) conditions.push({ source: query.source });
    if (query.tripId) conditions.push({ tripId: query.tripId });
    if (query.sppgId) conditions.push({ sppgId: query.sppgId });
    if (query.assigneeUserId) conditions.push({ assigneeUserId: query.assigneeUserId });
    if (query.assignedToMe) conditions.push({ assigneeUserId: principal.id });
    const search = query.search?.trim();
    if (search) {
      conditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { details: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ExceptionCaseWhereInput = { AND: conditions };
    const page = query.page;
    const pageSize = query.pageSize;
    const [total, data] = await this.prisma.db.$transaction([
      this.prisma.db.exceptionCase.count({ where }),
      this.prisma.db.exceptionCase.findMany({
        where,
        orderBy: [{ status: 'asc' }, { severity: 'desc' }, { openedAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          organizationId: true,
          regionId: true,
          sppgId: true,
          tripId: true,
          source: true,
          dedupeKey: true,
          title: true,
          severity: true,
          status: true,
          assigneeUserId: true,
          version: true,
          openedAt: true,
          dueAt: true,
          resolvedAt: true,
          closedAt: true,
          updatedAt: true,
          sppg: { select: { name: true } },
        },
      }),
    ]);

    const assigneeIds = [
      ...new Set(data.flatMap((item) => (item.assigneeUserId ? [item.assigneeUserId] : []))),
    ];
    const assignees = assigneeIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, username: true, displayName: true },
        })
      : [];
    const assigneeById = new Map(assignees.map((assignee) => [assignee.id, assignee]));

    return {
      data: data.map((item) => ({
        ...item,
        assignee: item.assigneeUserId ? assigneeById.get(item.assigneeUserId) ?? null : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async listAssignees(principal: SessionPrincipal, query: ListExceptionAssigneesDto) {
    const scope = await this.resolveScope(principal);
    const search = query.search?.trim();
    const users = await this.prisma.db.user.findMany({
      where: {
        status: AccountStatus.ACTIVE,
        ...this.assignableWhere(scope),
        ...(search
          ? {
              OR: [
                { username: { contains: search, mode: 'insensitive' as const } },
                { displayName: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ displayName: 'asc' }, { username: 'asc' }],
      take: 100,
      select: {
        id: true,
        username: true,
        displayName: true,
        roles: {
          where: this.effectiveRoleWhere(),
          select: {
            organizationId: true,
            regionId: true,
            sppgId: true,
            role: { select: { code: true, name: true, isGlobal: true } },
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles.map(({ role, organizationId, regionId, sppgId }) => ({
        code: role.code,
        name: role.name,
        isGlobal: role.isGlobal,
        organizationId,
        regionId,
        sppgId,
      })),
    }));
  }

  async get(principal: SessionPrincipal, id: string) {
    const exception = await this.prisma.db.exceptionCase.findUnique({
      where: { id },
      include: {
        events: { orderBy: { occurredAt: 'asc' } },
        trip: {
          select: {
            id: true,
            status: true,
            plannedDepartureAt: true,
            plannedArrivalAt: true,
            sppg: { select: { id: true, name: true } },
            deliveryLocation: { select: { id: true, name: true } },
            driver: { select: { id: true, displayName: true } },
          },
        },
      },
    });
    if (!exception) throw new NotFoundException({ code: 'EXCEPTION_NOT_FOUND' });
    if (!this.canAccess(principal, exception)) {
      throw new NotFoundException({ code: 'EXCEPTION_NOT_FOUND' });
    }
    return exception;
  }

  async create(
    principal: SessionPrincipal,
    input: CreateExceptionDto,
    requestId: string,
  ) {
    if (!input.sppgId && !input.tripId) {
      throw new BadRequestException({ code: 'TRIP_OR_SPPG_REQUIRED' });
    }

    let sppgId = input.sppgId;
    if (input.tripId) {
      const trip = await this.prisma.db.trip.findUnique({
        where: { id: input.tripId },
        select: {
          id: true,
          sppgId: true,
          sppg: { select: { organizationId: true, regionId: true } },
        },
      });
      if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      if (!this.canAccess(principal, {
        organizationId: trip.sppg.organizationId,
        regionId: trip.sppg.regionId,
        sppgId: trip.sppgId,
      })) {
        throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
      }
      if (sppgId && sppgId !== trip.sppgId) {
        throw new BadRequestException({ code: 'TRIP_SPPG_MISMATCH' });
      }
      sppgId = trip.sppgId;
    }
    const sppg = await this.prisma.db.sppg.findUnique({
      where: { id: sppgId! },
      select: { id: true, organizationId: true, regionId: true },
    });
    if (!sppg) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    if (input.tripId) {
      const trip = await this.prisma.db.trip.findUnique({
        where: { id: input.tripId },
        select: { organizationId: true },
      });
      if (trip && trip.organizationId !== sppg.organizationId) {
        throw new BadRequestException({ code: 'TRIP_SPPG_MISMATCH' });
      }
    }
    if (
      !this.canAccess(principal, {
        organizationId: sppg.organizationId,
        regionId: sppg.regionId,
        sppgId: sppg.id,
      })
    ) {
      throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    }

    if (input.dedupeKey) {
      const existing = await this.prisma.db.exceptionCase.findUnique({
        where: {
          organizationId_dedupeKey: {
            organizationId: sppg.organizationId,
            dedupeKey: input.dedupeKey,
          },
        },
      });
      if (existing) {
        if (!this.canAccess(principal, existing)) {
          throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
        }
        return { ...existing, deduped: true };
      }
    }

    return this.prisma.db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { legacySppgId: sppg.id } });
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      const created = await tx.exceptionCase.create({
        data: {
          tenantId: tenant.id,
          organizationId: sppg.organizationId,
          regionId: sppg.regionId,
          sppgId: sppg.id,
          tripId: input.tripId ?? null,
          source: input.source,
          dedupeKey: input.dedupeKey ?? null,
          title: input.title.trim(),
          details: input.details?.trim() ?? null,
          severity: input.severity ?? ExceptionSeverity.ATTENTION,
          createdByUserId: principal.id,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        },
      });
      await tx.exceptionEvent.create({
        data: {
          exceptionId: created.id,
          actorUserId: principal.id,
          action: 'CREATED',
          fromStatus: null,
          toStatus: ExceptionStatus.DETECTED,
          reason: input.reason.trim(),
          metadata: {
            source: input.source,
            dedupeKey: input.dedupeKey ?? null,
            tripId: input.tripId ?? null,
          },
        },
      });
      await this.audit(tx, {
        principal,
        exceptionId: created.id,
        action: 'exception.create',
        reason: input.reason,
        before: null,
        after: { status: created.status, severity: created.severity, version: created.version },
        requestId,
      });
      return { ...created, deduped: false };
    });
  }

  async createSystemAlert(
    input: {
      organizationId: string;
      regionId: string;
      sppgId: string;
      tripId: string;
      source: ExceptionSource;
      dedupeKey: string;
      title: string;
      details: string;
      severity: ExceptionSeverity;
      dueAt: Date | null;
      reason: string;
    },
    requestId = 'alert-worker',
  ) {
    return this.prisma.db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { legacySppgId: input.sppgId } });
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      const created = await tx.exceptionCase.create({
        data: {
          tenantId: tenant.id,
          organizationId: input.organizationId,
          regionId: input.regionId,
          sppgId: input.sppgId,
          tripId: input.tripId,
          source: input.source,
          dedupeKey: input.dedupeKey,
          title: input.title.slice(0, 200),
          details: input.details.slice(0, 4000),
          severity: input.severity,
          createdByUserId: null,
          dueAt: input.dueAt,
        },
      });
      await tx.exceptionEvent.create({
        data: {
          exceptionId: created.id,
          actorUserId: null,
          action: 'ALERT_RAISED',
          fromStatus: null,
          toStatus: ExceptionStatus.DETECTED,
          reason: input.reason,
          metadata: {
            origin: 'ALERT_WORKER',
            source: input.source,
            dedupeKey: input.dedupeKey,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: 'exception.alert.raise',
          entityType: 'exception_case',
          entityId: created.id,
          result: 'success',
          reason: input.reason,
          after: {
            status: created.status,
            severity: created.severity,
            source: created.source,
            tripId: created.tripId,
            dedupeKey: created.dedupeKey,
          },
          requestId,
        },
      });
      return created;
    });
  }

  async triage(
    principal: SessionPrincipal,
    id: string,
    input: TriageExceptionDto,
    requestId: string,
  ) {
    return this.transition(principal, id, input, requestId, {
      action: 'TRIAGED',
      toStatus: ExceptionStatus.TRIAGED,
      fromStatuses: [ExceptionStatus.DETECTED],
      data: { severity: input.severity },
    });
  }

  async assign(
    principal: SessionPrincipal,
    id: string,
    input: AssignExceptionDto,
    requestId: string,
  ) {
    const scope = await this.resolveScope(principal);
    const assignee = await this.prisma.db.user.findFirst({
      where: {
        id: input.assigneeUserId,
        status: AccountStatus.ACTIVE,
        ...this.assignableWhere(scope),
      },
      select: { id: true },
    });
    if (!assignee) {
      throw new BadRequestException({ code: 'ASSIGNEE_NOT_FOUND' });
    }
    return this.transition(principal, id, input, requestId, {
      action: 'ASSIGNED',
      toStatus: ExceptionStatus.ASSIGNED,
      fromStatuses: [ExceptionStatus.DETECTED, ExceptionStatus.TRIAGED],
      data: { assigneeUserId: input.assigneeUserId },
    });
  }

  async investigate(
    principal: SessionPrincipal,
    id: string,
    input: InvestigateExceptionDto,
    requestId: string,
  ) {
    return this.transition(principal, id, input, requestId, {
      action: 'INVESTIGATING',
      toStatus: ExceptionStatus.INVESTIGATING,
      fromStatuses: [ExceptionStatus.ASSIGNED, ExceptionStatus.ESCALATED],
    });
  }

  async resolve(
    principal: SessionPrincipal,
    id: string,
    input: ResolveExceptionDto,
    requestId: string,
  ) {
    return this.transition(principal, id, input, requestId, {
      action: 'RESOLVED',
      toStatus: ExceptionStatus.RESOLVED,
      fromStatuses: [
        ExceptionStatus.ASSIGNED,
        ExceptionStatus.INVESTIGATING,
        ExceptionStatus.ESCALATED,
      ],
      resolutionNote: input.resolutionNote,
    });
  }

  async escalate(
    principal: SessionPrincipal,
    id: string,
    input: EscalateExceptionDto,
    requestId: string,
  ) {
    return this.transition(principal, id, input, requestId, {
      action: 'ESCALATED',
      toStatus: ExceptionStatus.ESCALATED,
      fromStatuses: [
        ExceptionStatus.DETECTED,
        ExceptionStatus.TRIAGED,
        ExceptionStatus.ASSIGNED,
        ExceptionStatus.INVESTIGATING,
      ],
    });
  }

  async close(
    principal: SessionPrincipal,
    id: string,
    input: CloseExceptionDto,
    requestId: string,
  ) {
    return this.transition(principal, id, input, requestId, {
      action: input.outcome,
      toStatus: input.outcome as unknown as ExceptionStatus,
      fromStatuses: [
        ExceptionStatus.DETECTED,
        ExceptionStatus.TRIAGED,
        ExceptionStatus.ASSIGNED,
        ExceptionStatus.INVESTIGATING,
        ExceptionStatus.RESOLVED,
        ExceptionStatus.ESCALATED,
      ],
      resolutionNote: input.note,
      closed: true,
    });
  }

  private async transition(
    principal: SessionPrincipal,
    id: string,
    input: TransitionInput,
    requestId: string,
    options: {
      action: ExceptionCloseOutcome | 'TRIAGED' | 'ASSIGNED' | 'INVESTIGATING' | 'RESOLVED' | 'ESCALATED';
      toStatus: ExceptionStatus;
      fromStatuses: ExceptionStatus[];
      data?: Prisma.ExceptionCaseUpdateManyMutationInput;
      resolutionNote?: string;
      closed?: boolean;
    },
  ) {
    return this.prisma.db.$transaction(async (tx) => {
      const current = await tx.exceptionCase.findUnique({ where: { id } });
      if (!current) throw new NotFoundException({ code: 'EXCEPTION_NOT_FOUND' });
      if (!this.canAccess(principal, current)) {
        throw new NotFoundException({ code: 'EXCEPTION_NOT_FOUND' });
      }
      if (current.version !== input.version) {
        throw new ConflictException({ code: 'EXCEPTION_CHANGED_RETRY' });
      }
      if (!options.fromStatuses.includes(current.status)) {
        throw new ConflictException({ code: 'EXCEPTION_TRANSITION_NOT_ALLOWED' });
      }

      const now = new Date();
      const changed = await tx.exceptionCase.updateMany({
        where: { id, version: current.version, status: current.status },
        data: {
          ...options.data,
          status: options.toStatus,
          version: { increment: 1 },
          ...(options.resolutionNote !== undefined
            ? { resolutionNote: options.resolutionNote.trim() }
            : {}),
          ...(options.toStatus === ExceptionStatus.RESOLVED ? { resolvedAt: now } : {}),
          ...(options.closed ? { closedAt: now } : {}),
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({ code: 'EXCEPTION_CHANGED_RETRY' });
      }

      await tx.exceptionEvent.create({
        data: {
          exceptionId: id,
          actorUserId: principal.id,
          action: options.action,
          fromStatus: current.status,
          toStatus: options.toStatus,
          reason: input.reason.trim(),
          note: input.note?.trim() ?? null,
          metadata: options.resolutionNote
            ? { resolutionNote: options.resolutionNote.trim() }
            : undefined,
        },
      });
      await this.audit(tx, {
        principal,
        exceptionId: id,
        action: `exception.${options.action.toLowerCase()}`,
        reason: input.reason,
        before: { status: current.status, version: current.version },
        after: { status: options.toStatus, version: current.version + 1 },
        requestId,
      });

      const updated = await tx.exceptionCase.findUnique({ where: { id } });
      return updated!;
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    input: {
      principal: SessionPrincipal;
      exceptionId: string;
      action: string;
      reason: string;
      before: Prisma.InputJsonValue | null;
      after: Prisma.InputJsonValue;
      requestId: string;
    },
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: input.principal.id,
        action: input.action,
        entityType: 'exception_case',
        entityId: input.exceptionId,
        result: 'success',
        reason: input.reason.trim(),
        before: input.before ?? undefined,
        after: input.after,
        requestId: input.requestId,
      },
    });
  }

  private async resolveScope(principal: SessionPrincipal): Promise<ExceptionScope> {
    if (principal.roles.some((role) => role.isGlobal)) {
      return { global: true, organizationIds: [], regionIds: [], sppgIds: [] };
    }

    const organizationIds = new Set(
      principal.roles.flatMap((role) => (role.organizationId ? [role.organizationId] : [])),
    );
    const regionIds = new Set(
      principal.roles.flatMap((role) => (role.regionId ? [role.regionId] : [])),
    );
    const sppgIds = new Set(
      principal.roles.flatMap((role) => (role.sppgId ? [role.sppgId] : [])),
    );

    const [regions, sppgs] = await Promise.all([
      regionIds.size
        ? this.prisma.db.region.findMany({
            where: { id: { in: [...regionIds] } },
            select: { id: true, organizationId: true },
          })
        : [],
      sppgIds.size
        ? this.prisma.db.sppg.findMany({
            where: { id: { in: [...sppgIds] } },
            select: { id: true, organizationId: true, regionId: true },
          })
        : [],
    ]);

    for (const region of regions) organizationIds.add(region.organizationId);
    for (const sppg of sppgs) {
      organizationIds.add(sppg.organizationId);
      regionIds.add(sppg.regionId);
    }

    return {
      global: false,
      organizationIds: [...organizationIds],
      regionIds: [...regionIds],
      sppgIds: [...sppgIds],
    };
  }

  private effectiveRoleWhere(): Prisma.UserRoleWhereInput {
    const now = new Date();
    return {
      effectiveFrom: { lte: now },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
      role: { active: true },
    };
  }

  private assignableWhere(scope: ExceptionScope): Prisma.UserWhereInput {
    const scopeConditions: Prisma.UserRoleWhereInput[] = [];
    if (!scope.global) {
      if (scope.organizationIds.length) {
        scopeConditions.push({ organizationId: { in: scope.organizationIds } });
      }
      if (scope.regionIds.length) {
        scopeConditions.push({ regionId: { in: scope.regionIds } });
      }
      if (scope.sppgIds.length) {
        scopeConditions.push({ sppgId: { in: scope.sppgIds } });
      }
      if (!scopeConditions.length) return { id: { in: [] } };
    }

    const now = new Date();
    return {
      roles: {
        some: {
          AND: [
            { effectiveFrom: { lte: now } },
            { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
            {
              role: {
                is: {
                  active: true,
                  OR: [
                    { isGlobal: true },
                    { permissions: { some: { permission: { code: 'exception:manage' } } } },
                  ],
                },
              },
            },
            ...(scopeConditions.length ? [{ OR: scopeConditions }] : []),
          ],
        },
      },
    };
  }

  private canAccess(
    principal: SessionPrincipal,
    entity: { organizationId: string; regionId: string; sppgId: string },
  ) {
    return canAccessExceptionScope(principal, entity);
  }

  private scopeWhere(principal: SessionPrincipal): Prisma.ExceptionCaseWhereInput {
    if (principal.roles.some((role) => role.isGlobal)) return {};
    const organizationIds = [
      ...new Set(principal.roles.flatMap((role) => (role.organizationId ? [role.organizationId] : []))),
    ];
    const regionIds = [
      ...new Set(principal.roles.flatMap((role) => (role.regionId ? [role.regionId] : []))),
    ];
    const sppgIds = [
      ...new Set(principal.roles.flatMap((role) => (role.sppgId ? [role.sppgId] : []))),
    ];
    if (!organizationIds.length && !regionIds.length && !sppgIds.length) {
      return { id: { in: [] } };
    }
    return {
      OR: [
        ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
        ...(regionIds.length ? [{ regionId: { in: regionIds } }] : []),
        ...(sppgIds.length ? [{ sppgId: { in: sppgIds } }] : []),
      ],
    };
  }
}
