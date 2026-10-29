export interface DeliveryLocation {
    id: string;
    name: string;
    address: string;
    region: string;
    lat: number;
    lon: number;
    geofenceId: string | null;
}
export declare class LocationsService {
    private locs;
    list(): DeliveryLocation[];
}
