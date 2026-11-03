import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformGuard } from '../auth/platform.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PlatformService } from './platform.service.js';

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
  geofences(@Query() query: { tenantId?: string }) {
    return this.service.listGeofences(query.tenantId);
  }

  @Get('geofences/platform')
  platformGeofences(@Query() query: { tenantId?: string; active?: string }) {
    const active = query.active === 'true';
    return this.service.listPlatformGeofences(query.tenantId, active);
  }
}