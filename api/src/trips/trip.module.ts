import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripController } from './trip.controller.js';
import { GpsService } from './gps.service.js';
import { GeofenceController } from './geofence.controller.js';
import { GeofenceService } from './geofence.service.js';
import { ArrivalController } from './arrival.controller.js';
import { ArrivalService } from './arrival.service.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { RouteController } from './route.controller.js';
import { RouteService } from './route.service.js';
import { ProofService } from './proof.service.js';
import { TripService } from './trip.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [TripController, GeofenceController, RouteController, ArrivalController, DeliveryController],
  providers: [
    TripService,
    GpsService,
    GeofenceService,
    RouteService,
    ArrivalService,
    DeliveryService,
    ProofService,
  ],
})
export class TripModule {}
