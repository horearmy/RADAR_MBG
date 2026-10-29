import { TripStatus } from '../common/enums.js';
export interface Trip {
    id: string;
    organizationId: string;
    sppgLocationId: string;
    deliveryLocationId: string;
    vehicleId: string;
    driverId: string;
    plannedDepartureAt: string;
    plannedArrivalAt: string;
    actualDepartureAt?: string;
    arrivalDetectedAt?: string;
    arrivalVerifiedAt?: string;
    deliveryStartedAt?: string;
    deliveredAt?: string;
    completedAt?: string;
    status: TripStatus;
    plannedQuantity: number;
    dispatchedQuantity?: number;
    receivedQuantity?: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    version: number;
}
export declare class TripsService {
    private trips;
    constructor();
    create(data: Partial<Trip> & {
        createdBy: string;
    }): Trip;
    findAll(orgId?: string): Trip[];
    findOne(id: string): Trip;
    transition(id: string, to: TripStatus, actor: {
        userId: string;
        role: string;
    }): Trip;
    start(id: string, actor: {
        userId: string;
    }): Trip;
}
