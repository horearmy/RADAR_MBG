import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TripModule } from './trips/trip.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ExceptionModule } from './exceptions/exception.module.js';
import { AlertModule } from './alerts/alert.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, TripModule, AdminModule, ExceptionModule, AlertModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
