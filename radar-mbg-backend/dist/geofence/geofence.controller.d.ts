import { GeofenceService } from './geofence.service.js';
export declare class GeofenceController {
    private svc;
    constructor(svc: GeofenceService);
    create(b: any): import("./geofence.service.js").Geofence;
    list(): import("./geofence.service.js").Geofence[];
    check(b: any): {
        inside: boolean;
        distance: number;
    };
}
