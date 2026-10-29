var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let GeofenceService = class GeofenceService {
    fences = new Map();
    create(g) {
        const id = `gf_${Date.now()}`;
        const fence = { id, ...g };
        this.fences.set(id, fence);
        return fence;
    }
    list() { return Array.from(this.fences.values()); }
    distanceM(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = (d) => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }
    contains(fenceId, lat, lon) {
        const f = this.fences.get(fenceId);
        if (!f || !f.active)
            return { inside: false, distance: -1 };
        const d = this.distanceM(f.lat, f.lon, lat, lon);
        return { inside: d <= f.radiusM, distance: d };
    }
};
GeofenceService = __decorate([
    Injectable()
], GeofenceService);
export { GeofenceService };
//# sourceMappingURL=geofence.service.js.map