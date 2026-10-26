import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  CreateSppgStatusApprovalDto,
  DecideApprovalDto,
  ListApprovalRequestsDto,
} from './approval.dto.js';
import { ApprovalService } from './approval.service.js';

@Controller('admin')
@UseGuards(SessionGuard, PermissionGuard)
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}

  @Get('approval-requests/inbox')
  @RequirePermissions('approval:review')
  inbox(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListApprovalRequestsDto,
  ) {
    return this.approvals.listInbox(request.principal!, query);
  }

  @Get('approval-requests/mine')
  @RequirePermissions('sppg:manage')
  mine(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListApprovalRequestsDto,
  ) {
    return this.approvals.listMine(request.principal!, query);
  }

  @Get('approval-requests/eligible-sppgs')
  @RequirePermissions('sppg:manage')
  eligibleSppgs(@Req() request: AuthenticatedRequest) {
    return this.approvals.listSppgsForStatusChange(request.principal!);
  }

  @Post('sppg/:id/status-approval')
  @RequirePermissions('sppg:manage')
  requestSppgStatusChange(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateSppgStatusApprovalDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.approvals.requestSppgStatusChange(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  @Post('approval-requests/:id/decision')
  @RequirePermissions('approval:review')
  decide(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DecideApprovalDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.approvals.decide(
      request.principal!,
      id,
      input,
      this.safeRequestId(requestId),
    );
  }

  private safeRequestId(candidate?: string) {
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}
