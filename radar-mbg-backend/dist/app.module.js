var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TripsModule } from './trips/trips.module.js';
import { GpsModule } from './gps/gps.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditModule } from './audit/audit.module.js';
import { GeofenceModule } from './geofence/geofence.module.js';
import { QrModule } from './qr/qr.module.js';
import { PodModule } from './pod/pod.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { ReportingModule } from './reporting/reporting.module.js';
import { SppgModule } from './sppg/sppg.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { DriversModule } from './drivers/drivers.module.js';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [TripsModule, GpsModule, AuthModule, AuditModule, GeofenceModule, QrModule, PodModule, AlertsModule, ReportingModule, SppgModule, VehiclesModule, LocationsModule, DriversModule],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map