export declare class ReportingController {
    trips(q: any): {
        message: string;
        filters: any;
        generatedAt: string;
    };
    summary(): {
        tripsToday: number;
        inTransit: number;
        verifiedArrivals: number;
        delivered: number;
        late: number;
        staleTracking: number;
        activeAlerts: number;
    };
}
