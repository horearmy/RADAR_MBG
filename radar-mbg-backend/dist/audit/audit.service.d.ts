export interface AuditEvent {
    id: string;
    occurredAt: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: any;
    after?: any;
    reason?: string;
    requestId?: string;
}
export declare class AuditService {
    private events;
    log(e: Omit<AuditEvent, 'id' | 'occurredAt'>): AuditEvent;
    findAll(filter?: {
        entityType?: string;
        entityId?: string;
    }): AuditEvent[];
}
