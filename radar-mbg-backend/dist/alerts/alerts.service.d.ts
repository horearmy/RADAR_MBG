export interface Alert {
    id: string;
    type: string;
    severity: 'NORMAL' | 'ATTENTION' | 'HIGH' | 'CRITICAL';
    tripId?: string;
    title: string;
    reason: string;
    status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED' | 'FALSE_POSITIVE';
    createdAt: string;
    updatedAt: string;
}
export declare class AlertsService {
    private alerts;
    create(a: Omit<Alert, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Alert;
    list(filter?: {
        severity?: string;
        status?: string;
    }): Alert[];
    ack(id: string): Alert;
    resolve(id: string, reason?: string): Alert;
}
