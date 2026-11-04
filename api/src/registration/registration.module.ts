import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { PublicRegistrationController } from './registration.controller.js';
import { RegistrationAdminController } from './registration-admin.controller.js';
import { RegistrationService } from './registration.service.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [PublicRegistrationController, RegistrationAdminController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
