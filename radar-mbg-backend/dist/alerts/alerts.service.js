var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let AlertsService = class AlertsService {
    alerts = new Map();
    create(a) {
        const id = `alt_${Date.now()}`;
        const now = new Date().toISOString();
        const alert = { id, ...a, status: 'NEW', createdAt: now, updatedAt: now };
        this.alerts.set(id, alert);
        return alert;
    }
    list(filter) {
        let all = Array.from(this.alerts.values());
        if (filter?.severity)
            all = all.filter(a => a.severity === filter.severity);
        if (filter?.status)
            all = all.filter(a => a.status === filter.status);
        return all;
    }
    ack(id) { const a = this.alerts.get(id); if (!a)
        throw new Error('not found'); a.status = 'ACKNOWLEDGED'; a.updatedAt = new Date().toISOString(); return a; }
    resolve(id, reason) { const a = this.alerts.get(id); if (!a)
        throw new Error('not found'); a.status = 'RESOLVED'; if (reason)
        a.reason = reason; a.updatedAt = new Date().toISOString(); return a; }
};
AlertsService = __decorate([
    Injectable()
], AlertsService);
export { AlertsService };
//# sourceMappingURL=alerts.service.js.map