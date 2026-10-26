import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { ApprovalController } from './approval.controller.js';
import { ApprovalService } from './approval.service.js';
import { MasterDataController } from './master-data.controller.js';
import { MasterDataService } from './master-data.service.js';
import { UserAdminController } from './user-admin.controller.js';
import { UserAdminService } from './user-admin.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MasterDataController, ApprovalController, AuditController, UserAdminController],
  providers: [MasterDataService, ApprovalService, AuditService, UserAdminService],
})
export class AdminModule {}
