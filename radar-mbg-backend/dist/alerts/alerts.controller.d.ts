import { AlertsService } from './alerts.service.js';
export declare class AlertsController {
    private svc;
    constructor(svc: AlertsService);
    list(q: any): import("./alerts.service.js").Alert[];
    create(b: any): import("./alerts.service.js").Alert;
    ack(id: string): import("./alerts.service.js").Alert;
    resolve(id: string, b: any): import("./alerts.service.js").Alert;
}
