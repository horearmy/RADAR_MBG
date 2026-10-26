import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsDto } from './audit.dto.js';

@Controller('admin/audit-logs')
@UseGuards(SessionGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly audits: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListAuditLogsDto) {
    return this.audits.list(request.principal!, query);
  }
}
