import { AuditService } from './audit.service.js';
export declare class AuditController {
    private svc;
    constructor(svc: AuditService);
    list(q: any): import("./audit.service.js").AuditEvent[];
}
