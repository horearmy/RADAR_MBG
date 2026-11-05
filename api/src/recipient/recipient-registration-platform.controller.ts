import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { PlatformGuard } from '../auth/platform.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { RecipientRegistrationService } from './recipient-registration.service.js';
import { ReviewRecipientRegistrationRequestDto } from './recipient-registration.dto.js';

@Controller('platform/recipient-registrations')
@UseGuards(SessionGuard, PlatformGuard, PermissionGuard)
export class RecipientRegistrationPlatformController {
  constructor(private readonly service: RecipientRegistrationService) {}

  @Get('sites')
  @RequirePermissions('admin:manage_users')
  sites(@Query('tenantId') tenantId?: string) {
    return this.service.listRecipientSites(tenantId ?? null);
  }

  @Get()
  @RequirePermissions('admin:manage_users')
  list(@Req() request: AuthenticatedRequest, @Query('tenantId') tenantId?: string) {
    return this.service.listRequests(request.principal!, tenantId ?? null);
  }

  @Patch(':id/approve')
  @RequirePermissions('admin:manage_users')
  approve(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: ReviewRecipientRegistrationRequestDto, @Query('tenantId') tenantId?: string) {
    input.decision = 'APPROVE';
    return this.service.reviewRequest(id, input, request.principal!, tenantId ?? null);
  }

  @Patch(':id/reject')
  @RequirePermissions('admin:manage_users')
  reject(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: ReviewRecipientRegistrationRequestDto, @Query('tenantId') tenantId?: string) {
    input.decision = 'REJECT';
    return this.service.reviewRequest(id, input, request.principal!, tenantId ?? null);
  }

  @Patch(':id/request-revision')
  @RequirePermissions('admin:manage_users')
  requestRevision(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() input: ReviewRecipientRegistrationRequestDto, @Query('tenantId') tenantId?: string) {
    input.decision = 'REVISION_REQUIRED';
    return this.service.reviewRequest(id, input, request.principal!, tenantId ?? null);
  }
}