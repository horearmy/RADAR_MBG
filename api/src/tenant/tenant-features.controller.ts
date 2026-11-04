import { UseGuards, Body, Controller, Post, Req } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { RequireTenant, TenantGuard } from '../auth/tenant.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { TenantService } from './tenant.service.js';

export type FeaturesConfig = {
  drivers?: boolean;
  trips?: boolean;
  vehicles?: boolean;
  audit?: boolean;
  profiling?: boolean;
};

@Controller('tenant')
@RequireTenant()
@UseGuards(SessionGuard, TenantGuard, PermissionGuard)
export class TenantFeaturesController {
  constructor(private readonly service: TenantService) {}

  @Post('features')
  @RequirePermissions('tenant:manage')
  async setFeatures(
    @Req() req: AuthenticatedRequest,
    @Body() body: { features: FeaturesConfig },
  ) {
    const tenantId = req.tenantContext!.tenantId;
    const userId = req.principal!.id;
    return this.service.setTenantFeatures(tenantId, userId, body.features);
  }
}
