import { GpsService } from './gps.service.js';
export declare class GpsController {
    private readonly gps;
    constructor(gps: GpsService);
    ingest(id: string, body: any): {
        accepted: number;
        rejected: number;
        points: import("./gps.service.js").GpsPoint[];
    };
    track(id: string): import("./gps.service.js").GpsPoint[];
}
