var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let PodService = class PodService {
    pods = new Map();
    submit(data) {
        const shortage = Math.max(0, data.dispatched - data.received - data.damaged);
        const pod = {
            id: `pod_${Date.now()}`,
            ...data,
            shortage,
            submittedAt: new Date().toISOString(),
            status: shortage > 0 ? 'POD_NEEDS_REVIEW' : 'POD_SUBMITTED',
        };
        this.pods.set(pod.id, pod);
        return pod;
    }
    list(tripId) {
        const all = Array.from(this.pods.values());
        return tripId ? all.filter(p => p.tripId === tripId) : all;
    }
    review(id, status) {
        const p = this.pods.get(id);
        if (!p)
            throw new Error('POD not found');
        p.status = status;
        return p;
    }
};
PodService = __decorate([
    Injectable()
], PodService);
export { PodService };
//# sourceMappingURL=pod.service.js.map