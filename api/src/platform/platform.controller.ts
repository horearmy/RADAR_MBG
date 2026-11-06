import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PlatformGuard } from '../auth/platform.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PlatformService } from './platform.service.js';
import { RequirePermissions } from '../auth/permissions.js';

@Controller('platform')
@UseGuards(SessionGuard, PlatformGuard)
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('tenants')
  tenants() {
    return this.service.listTenants();
  }

  @Get('summary')
  summary(@Query() query: { tenantId?: string; from?: string; to?: string }) {
    return this.service.summary(query);
  }

  @Get('dashboard-summary')
  dashboardSummary() {
    return this.service.dashboardSummary();
  }

  @Get('geofences')
  geofences(@Query() query: { tenantId?: string; active?: string }) {
    const active = query.active === undefined ? undefined : query.active === 'true';
    return this.service.listGeofences(query.tenantId, active);
  }

  @Get('geofences/platform')
  platformGeofences(@Query() query: { tenantId?: string; active?: string }) {
    const active = query.active === 'true';
    return this.service.listPlatformGeofences(query.tenantId, active);
  }

  @Get('recipient-reviews/summary')
  recipientReviewSummary(@Query() query: { tenantId?: string; from?: string; to?: string }) {
    return this.service.recipientReviewSummary(query.tenantId, query.from, query.to);
  }

  @Get('recipient-reviews/recent')
  recipientReviewsRecent(@Query() query: { tenantId?: string; limit?: string }) {
    return this.service.recipientReviewsRecent(query.tenantId, Number(query.limit ?? 20));
  }

  @Patch('tenants/:id/suspend')
  @RequirePermissions('admin:manage_users')
  suspendTenant(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.suspendTenant(id, request.principal!, this.requestId(request), body?.reason);
  }

  @Patch('tenants/:id/archive')
  @RequirePermissions('admin:manage_users')
  archiveTenant(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.archiveTenant(id, request.principal!, this.requestId(request), body?.reason);
  }

  @Patch('tenants/:id/reactivate')
  @RequirePermissions('admin:manage_users')
  reactivateTenant(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reactivateTenant(id, request.principal!, this.requestId(request), body?.reason);
  }

  private requestId(request: AuthenticatedRequest) {
    const candidate = request.get('x-request-id');
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}