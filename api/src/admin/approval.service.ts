import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, Prisma, SppgStatus } from '@prisma/client';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  ApprovalDecisionInput,
  CreateSppgStatusApprovalDto,
  DecideApprovalDto,
  ListApprovalRequestsDto,
} from './approval.dto.js';
import { assertApprovalReviewer } from './approval-policy.js';

const ACTION_TYPE = 'SPPG_STATUS_CHANGE';
const TARGET_TYPE = 'SPPG';

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  async listSppgsForStatusChange(principal: SessionPrincipal) {
    const where = await this.scopedSppgWhere(principal);
    if (!where) return this.prisma.db.sppg.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, status: true, version: true },
    });
    if (Object.keys(where).length === 0) return [];
    return this.prisma.db.sppg.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, status: true, version: true },
    });
  }

  async listInbox(principal: SessionPrincipal, query: ListApprovalRequestsDto) {
    const where = await this.scopedSppgWhere(principal);
    if (where && Object.keys(where).length === 0) return this.emptyPage(query);
    const sppgs = where
      ? await this.prisma.db.sppg.findMany({ where, select: { id: true } })
      : null;
    return this.listRequests({
      status: ApprovalStatus.PENDING_APPROVAL,
      ...(sppgs ? { targetId: { in: sppgs.map(({ id }) => id) } } : {}),
    }, query);
  }

  async listMine(principal: SessionPrincipal, query: ListApprovalRequestsDto) {
    const where = await this.scopedSppgWhere(principal);
    if (where && Object.keys(where).length === 0) return this.emptyPage(query);
    const sppgs = where
      ? await this.prisma.db.sppg.findMany({ where, select: { id: true } })
      : null;
    return this.listRequests({
      requestedBy: principal.id,
      ...(sppgs ? { targetId: { in: sppgs.map(({ id }) => id) } } : {}),
    }, query);
  }

  async requestSppgStatusChange(
    principal: SessionPrincipal,
    sppgId: string,
    input: CreateSppgStatusApprovalDto,
    requestId: string,
  ) {
    const before = await this.prisma.db.sppg.findUnique({ where: { id: sppgId } });
    if (!before) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    await this.assertSppgAccess(principal, before);
    if (before.version !== input.version) {
      throw new ConflictException({ code: 'MASTER_DATA_VERSION_CONFLICT' });
    }
    if (before.status === input.targetStatus) {
      throw new BadRequestException({ code: 'SPPG_STATUS_UNCHANGED' });
    }

    return this.prisma.db.$transaction(async (tx) => {
      const activeRequest = await tx.approvalRequest.findFirst({
        where: {
          targetType: TARGET_TYPE,
          targetId: sppgId,
          actionType: ACTION_TYPE,
          status: { in: [ApprovalStatus.SUBMITTED, ApprovalStatus.PENDING_APPROVAL, ApprovalStatus.APPROVED] },
        },
        select: { id: true },
      });
      if (activeRequest) throw new ConflictException({ code: 'APPROVAL_REQUEST_ALREADY_PENDING' });

      const current = await tx.sppg.findUnique({ where: { id: sppgId } });
      if (!current || current.version !== input.version || current.status !== before.status) {
        throw new ConflictException({ code: 'MASTER_DATA_VERSION_CONFLICT' });
      }

      const approvalRequest = await tx.approvalRequest.create({
        data: {
          actionType: ACTION_TYPE,
          targetType: TARGET_TYPE,
          targetId: sppgId,
          requestedBy: principal.id,
          reason: input.reason.trim(),
          payloadBefore: { status: current.status, version: current.version },
          payloadAfter: { status: input.targetStatus },
          status: ApprovalStatus.PENDING_APPROVAL,
          objectVersion: current.version,
          submittedAt: new Date(),
          correlationId: requestId,
        },
      });
      await this.writeAudit(tx, principal.id, 'approval.request', 'approval_request', approvalRequest.id, input.reason, null, {
        targetType: TARGET_TYPE,
        targetId: sppgId,
        actionType: ACTION_TYPE,
        status: approvalRequest.status,
        requestedStatus: input.targetStatus,
      }, requestId);
      return approvalRequest;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async decide(
    principal: SessionPrincipal,
    approvalId: string,
    input: DecideApprovalDto,
    requestId: string,
  ) {
    return this.prisma.db.$transaction(async (tx) => {
      const approval = await tx.approvalRequest.findUnique({ where: { id: approvalId } });
      if (!approval || approval.actionType !== ACTION_TYPE || approval.targetType !== TARGET_TYPE) {
        throw new NotFoundException({ code: 'APPROVAL_REQUEST_NOT_FOUND' });
      }
      const sppg = await tx.sppg.findUnique({ where: { id: approval.targetId } });
      if (!sppg) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
      await this.assertSppgAccess(principal, sppg);
      assertApprovalReviewer(approval.status, approval.requestedBy, principal.id);

      const payloadBefore = approval.payloadBefore as Prisma.JsonObject | null;
      const payloadAfter = approval.payloadAfter as Prisma.JsonObject;
      const requestedStatus = payloadAfter.status;
      if (!Object.values(SppgStatus).includes(requestedStatus as SppgStatus)) {
        throw new ConflictException({ code: 'APPROVAL_PAYLOAD_INVALID' });
      }

      if (input.decision === ApprovalDecisionInput.APPROVED && (
        approval.objectVersion !== sppg.version ||
        payloadBefore?.status !== sppg.status || sppg.status === requestedStatus
      )) {
        const failed = await tx.approvalRequest.update({
          where: { id: approval.id },
          data: { status: ApprovalStatus.FAILED },
        });
        await tx.approvalDecision.create({
          data: {
            approvalRequestId: approval.id,
            approverId: principal.id,
            decision: 'FAILED_STALE_OBJECT',
            reason: 'Objek berubah setelah permintaan diajukan; ajukan permintaan baru.',
          },
        });
        await this.writeAudit(tx, principal.id, 'approval.execution_failed', 'approval_request', approval.id,
          'Objek berubah setelah permintaan diajukan.', { status: approval.status, objectVersion: approval.objectVersion },
          { status: failed.status, targetId: approval.targetId }, requestId);
        return failed;
      }

      const decisionStatus = input.decision === ApprovalDecisionInput.APPROVED
        ? ApprovalStatus.APPROVED
        : ApprovalStatus.REJECTED;
      await tx.approvalDecision.create({
        data: {
          approvalRequestId: approval.id,
          approverId: principal.id,
          decision: input.decision,
          reason: input.reason.trim(),
        },
      });

      if (input.decision === ApprovalDecisionInput.REJECTED) {
        const rejected = await tx.approvalRequest.update({
          where: { id: approval.id },
          data: { status: ApprovalStatus.REJECTED },
        });
        await this.writeAudit(tx, principal.id, 'approval.rejected', 'approval_request', approval.id,
          input.reason, { status: approval.status }, { status: rejected.status, targetId: approval.targetId }, requestId);
        return rejected;
      }

      await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: decisionStatus } });

      const updatedSppg = await tx.sppg.updateMany({
        where: { id: sppg.id, version: approval.objectVersion!, status: sppg.status },
        data: { status: requestedStatus as SppgStatus, version: { increment: 1 } },
      });
      if (updatedSppg.count !== 1) throw new ConflictException({ code: 'MASTER_DATA_VERSION_CONFLICT' });

      const executed = await tx.approvalRequest.update({
        where: { id: approval.id },
        data: { status: ApprovalStatus.EXECUTED, executedAt: new Date() },
      });
      await this.writeAudit(tx, principal.id, 'approval.executed', 'sppg', sppg.id, input.reason,
        { status: sppg.status, version: sppg.version },
        { status: requestedStatus, version: sppg.version + 1, approvalRequestId: approval.id }, requestId);
      await this.writeAudit(tx, principal.id, 'approval.approved', 'approval_request', approval.id,
        input.reason, { status: approval.status }, { status: executed.status, targetId: sppg.id }, requestId);
      return executed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async listRequests(
    filter: Prisma.ApprovalRequestWhereInput,
    query: ListApprovalRequestsDto,
  ) {
    const where: Prisma.ApprovalRequestWhereInput = {
      ...filter,
      targetType: TARGET_TYPE,
      actionType: ACTION_TYPE,
    };
    const [data, total] = await Promise.all([
      this.prisma.db.approvalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          requester: { select: { id: true, username: true, displayName: true } },
          decisions: {
            orderBy: { decidedAt: 'asc' },
            include: { approver: { select: { id: true, username: true, displayName: true } } },
          },
        },
      }),
      this.prisma.db.approvalRequest.count({ where }),
    ]);
    const sppgs = data.length
      ? await this.prisma.db.sppg.findMany({
          where: { id: { in: data.map(({ targetId }) => targetId) } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const sppgById = new Map(sppgs.map((sppg) => [sppg.id, sppg]));
    return {
      data: data.map((request) => ({ ...request, requestedByUser: request.requester, target: sppgById.get(request.targetId) ?? null })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private async scopedSppgWhere(principal: SessionPrincipal): Promise<Prisma.SppgWhereInput | null> {
    if (principal.roles.some((role) => role.isGlobal)) return null;
    const organizationIds = [...new Set(principal.roles.flatMap((role) => role.organizationId ? [role.organizationId] : []))];
    const regionIds = [...new Set(principal.roles.flatMap((role) => role.regionId ? [role.regionId] : []))];
    const sppgIds = [...new Set(principal.roles.flatMap((role) => role.sppgId ? [role.sppgId] : []))];
    if (principal.tenantId) {
      const tenant = await this.prisma.db.tenant.findFirst({
        where: { id: principal.tenantId, status: 'ACTIVE' },
        select: { legacySppgId: true },
      });
      if (tenant?.legacySppgId) sppgIds.push(tenant.legacySppgId);
    }
    const OR: Prisma.SppgWhereInput[] = [
      ...(organizationIds.length ? [{ organizationId: { in: organizationIds } }] : []),
      ...(regionIds.length ? [{ regionId: { in: regionIds } }] : []),
      ...(sppgIds.length ? [{ id: { in: sppgIds } }] : []),
    ];
    return OR.length ? { OR } : {};
  }

  private async assertSppgAccess(
    principal: SessionPrincipal,
    sppg: { id: string; organizationId: string; regionId: string },
  ) {
    let allowed = principal.roles.some((role) =>
      role.isGlobal || role.organizationId === sppg.organizationId ||
      role.regionId === sppg.regionId || role.sppgId === sppg.id,
    );
    if (!allowed && principal.tenantId) {
      const tenant = await this.prisma.db.tenant.findFirst({
        where: { id: principal.tenantId, legacySppgId: sppg.id, status: 'ACTIVE' },
        select: { id: true },
      });
      allowed = Boolean(tenant);
    }
    if (!allowed) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
  }

  private emptyPage(query: ListApprovalRequestsDto) {
    return {
      data: [],
      pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 },
    };
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
