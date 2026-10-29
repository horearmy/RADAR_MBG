var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TripStatus, ALLOWED_TRANSITIONS } from '../common/enums.js';
let TripsService = class TripsService {
    trips = new Map();
    constructor() {
        const now = new Date().toISOString();
        const seed = {
            id: 'trip_seed_1',
            organizationId: 'org1',
            sppgLocationId: 'sppg1',
            deliveryLocationId: 'loc1',
            vehicleId: 'v2',
            driverId: 'driver1',
            plannedDepartureAt: now,
            plannedArrivalAt: new Date(Date.now() + 3600000).toISOString(),
            status: TripStatus.SCHEDULED,
            plannedQuantity: 100,
            createdBy: 'system',
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        this.trips.set(seed.id, seed);
    }
    create(data) {
        const id = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        const trip = {
            id,
            organizationId: data.organizationId,
            sppgLocationId: data.sppgLocationId,
            deliveryLocationId: data.deliveryLocationId,
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            plannedDepartureAt: data.plannedDepartureAt,
            plannedArrivalAt: data.plannedArrivalAt,
            status: TripStatus.DRAFT,
            plannedQuantity: data.plannedQuantity ?? 0,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        this.trips.set(id, trip);
        return trip;
    }
    findAll(orgId) {
        const all = Array.from(this.trips.values());
        return orgId ? all.filter(t => t.organizationId === orgId) : all;
    }
    findOne(id) {
        const t = this.trips.get(id);
        if (!t)
            throw new NotFoundException('Trip not found');
        return t;
    }
    transition(id, to, actor) {
        const trip = this.findOne(id);
        const allowed = ALLOWED_TRANSITIONS[trip.status] ?? [];
        if (!allowed.includes(to)) {
            throw new BadRequestException(`Illegal transition ${trip.status} -> ${to}`);
        }
        trip.status = to;
        trip.updatedAt = new Date().toISOString();
        trip.version += 1;
        if (to === TripStatus.IN_TRANSIT && !trip.actualDepartureAt)
            trip.actualDepartureAt = new Date().toISOString();
        if (to === TripStatus.ARRIVAL_DETECTED && !trip.arrivalDetectedAt)
            trip.arrivalDetectedAt = new Date().toISOString();
        if (to === TripStatus.ARRIVAL_VERIFIED && !trip.arrivalVerifiedAt)
            trip.arrivalVerifiedAt = new Date().toISOString();
        if (to === TripStatus.DELIVERY_IN_PROGRESS && !trip.deliveryStartedAt)
            trip.deliveryStartedAt = new Date().toISOString();
        if (to === TripStatus.DELIVERED && !trip.deliveredAt)
            trip.deliveredAt = new Date().toISOString();
        if (to === TripStatus.COMPLETED && !trip.completedAt)
            trip.completedAt = new Date().toISOString();
        return trip;
    }
    start(id, actor) {
        const trip = this.findOne(id);
        if (trip.driverId !== actor.userId)
            throw new ForbiddenException('Not assigned driver');
        return this.transition(id, TripStatus.IN_TRANSIT, { userId: actor.userId, role: 'DRIVER' });
    }
};
TripsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], TripsService);
export { TripsService };
//# sourceMappingURL=trips.service.js.map