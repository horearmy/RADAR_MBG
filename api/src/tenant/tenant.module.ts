import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TenantController } from './tenant.controller.js';
import { TenantService } from './tenant.service.js';
import { EmailService } from './email.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TenantController],
  providers: [TenantService, EmailService],
  exports: [TenantService, EmailService],
})
export class TenantModule {}
