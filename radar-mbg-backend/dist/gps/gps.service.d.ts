export interface GpsPoint {
    id: string;
    tripId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    deviceTimestamp: string;
    serverReceivedAt: string;
    sequenceNumber?: number;
    integrityFlags: string[];
}
export declare class GpsService {
    private points;
    private seenKeys;
    ingest(tripId: string, batch: any[]): {
        accepted: number;
        rejected: number;
        points: GpsPoint[];
    };
    private validCoords;
    private flags;
    track(tripId: string): GpsPoint[];
    lastSeen(tripId: string): GpsPoint | null;
}
