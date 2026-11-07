import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { TenantGuard, RequireTenant } from '../auth/tenant.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { RecipientRegistrationService } from './recipient-registration.service.js';
import { ReviewRecipientRegistrationRequestDto } from './recipient-registration.dto.js';

@Controller('tenant/recipient-registrations')
@UseGuards(SessionGuard, TenantGuard, PermissionGuard)
@RequireTenant()
export class RecipientRegistrationTenantController {
  constructor(private readonly service: RecipientRegistrationService) {}

  @Get('sites')
  @RequirePermissions('tenant:manage')
  sites(@Req() request: AuthenticatedRequest) {
    return this.service.listRecipientSites(request.tenantContext?.tenantId ?? null);
  }

  @Get('codes')
  @RequirePermissions('tenant:manage')
  listCodes(@Req() request: AuthenticatedRequest) {
    return this.service.listRegistrationCodes(request.tenantContext?.tenantId ?? null);
  }

  @Post('codes')
  @RequirePermissions('tenant:manage')
  createCode(@Req() request: AuthenticatedRequest) {
    return this.service.createRegistrationCode(request.tenantContext!.tenantId, request.principal!.id);
  }

  @Delete('codes/:id')
  @RequirePermissions('tenant:manage')
  deactivateCode(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.deactivateRegistrationCode(request.tenantContext?.tenantId ?? null, id);
  }

  @Get()
  @RequirePermissions('tenant:manage')
  list(@Req() request: AuthenticatedRequest, @Query('tenantId') tenantId?: string) {
    return this.service.listRequests(request.principal!, request.tenantContext?.tenantId ?? tenantId ?? null);
  }

  @Patch(':id/approve')
  @RequirePermissions('tenant:manage')
  approve(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: ReviewRecipientRegistrationRequestDto) {
    input.decision = 'APPROVE';
    return this.service.reviewRequest(id, input, request.principal!, request.tenantContext?.tenantId ?? null);
  }

  @Patch(':id/reject')
  @RequirePermissions('tenant:manage')
  reject(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: ReviewRecipientRegistrationRequestDto) {
    input.decision = 'REJECT';
    return this.service.reviewRequest(id, input, request.principal!, request.tenantContext?.tenantId ?? null);
  }

  @Patch(':id/request-revision')
  @RequirePermissions('tenant:manage')
  requestRevision(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: ReviewRecipientRegistrationRequestDto) {
    input.decision = 'REVISION_REQUIRED';
    return this.service.reviewRequest(id, input, request.principal!, request.tenantContext?.tenantId ?? null);
  }
}