import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TripModule } from './trips/trip.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ExceptionModule } from './exceptions/exception.module.js';
import { AlertModule } from './alerts/alert.module.js';
import { RecipientModule } from './recipient/recipient.module.js';
import { TenantModule } from './tenant/tenant.module.js';
import { RegistrationModule } from './registration/registration.module.js';
import { PlatformModule } from './platform/platform.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, TripModule, AdminModule, ExceptionModule, AlertModule, TenantModule, RegistrationModule, PlatformModule, RecipientModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
