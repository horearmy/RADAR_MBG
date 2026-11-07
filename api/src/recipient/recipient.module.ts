import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { RecipientController } from './recipient.controller.js';
import { RecipientRegistrationPlatformController } from './recipient-registration-platform.controller.js';
import { RecipientRegistrationPublicController } from './recipient-registration-public.controller.js';
import { RecipientRegistrationTenantController } from './recipient-registration-tenant.controller.js';
import { RecipientRegistrationService } from './recipient-registration.service.js';
import { RecipientService } from './recipient.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, StorageModule],
  controllers: [
    RecipientController,
    RecipientRegistrationPlatformController,
    RecipientRegistrationPublicController,
    RecipientRegistrationTenantController,
  ],
  providers: [RecipientRegistrationService, RecipientService],
})
export class RecipientModule {}
