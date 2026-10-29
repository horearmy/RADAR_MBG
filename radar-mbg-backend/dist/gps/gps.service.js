var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let GpsService = class GpsService {
    points = new Map();
    seenKeys = new Set();
    ingest(tripId, batch) {
        const accepted = [];
        let rejected = 0;
        for (const raw of batch) {
            const key = `${tripId}:${raw.deviceTimestamp}:${raw.latitude}:${raw.longitude}`;
            if (this.seenKeys.has(key)) {
                rejected++;
                continue;
            }
            if (!this.validCoords(raw.latitude, raw.longitude)) {
                rejected++;
                continue;
            }
            const point = {
                id: `gps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                tripId,
                latitude: raw.latitude,
                longitude: raw.longitude,
                accuracy: raw.accuracy ?? 999,
                deviceTimestamp: raw.deviceTimestamp,
                serverReceivedAt: new Date().toISOString(),
                sequenceNumber: raw.sequenceNumber,
                integrityFlags: this.flags(raw),
            };
            this.seenKeys.add(key);
            if (!this.points.has(tripId))
                this.points.set(tripId, []);
            this.points.get(tripId).push(point);
            accepted.push(point);
        }
        return { accepted: accepted.length, rejected, points: accepted };
    }
    validCoords(lat, lon) {
        return typeof lat === 'number' && typeof lon === 'number' && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }
    flags(raw) {
        const f = [];
        if (raw.accuracy > 50)
            f.push('LOW_ACCURACY');
        const dev = new Date(raw.deviceTimestamp).getTime();
        const now = Date.now();
        if (Math.abs(now - dev) > 5 * 60 * 1000)
            f.push('TIME_SKEW');
        return f;
    }
    track(tripId) {
        return this.points.get(tripId) ?? [];
    }
    lastSeen(tripId) {
        const pts = this.points.get(tripId);
        if (!pts || pts.length === 0)
            return null;
        return pts[pts.length - 1];
    }
};
GpsService = __decorate([
    Injectable()
], GpsService);
export { GpsService };
//# sourceMappingURL=gps.service.js.map