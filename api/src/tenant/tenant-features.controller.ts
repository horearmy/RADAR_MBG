import { UseGuards, Body, Controller, Post, Req } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { TenantGuard } from '../auth/tenant.guard.js';
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
@UseGuards(SessionGuard, TenantGuard)
export class TenantFeaturesController {
  constructor(private readonly service: TenantService) {}

  @Post('features')
  async setFeatures(
    @Req() req: AuthenticatedRequest,
    @Body() body: { features: FeaturesConfig },
  ) {
    const tenantId = req.tenantContext!.tenantId;
    const userId = req.principal!.id;
    return this.service.setTenantFeatures(tenantId, userId, body.features);
  }
}