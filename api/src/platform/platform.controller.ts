import { Controller, Get, Query } from '@nestjs/common';
import { PlatformService } from './platform.service.js';

@Controller('platform')
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
}
