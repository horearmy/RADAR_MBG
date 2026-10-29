export interface Geofence {
    id: string;
    name: string;
    type: 'SPPG' | 'DELIVERY' | 'OTHER';
    lat: number;
    lon: number;
    radiusM: number;
    active: boolean;
}
export declare class GeofenceService {
    private fences;
    create(g: Omit<Geofence, 'id'>): Geofence;
    list(): Geofence[];
    distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number;
    contains(fenceId: string, lat: number, lon: number): {
        inside: boolean;
        distance: number;
    };
}
