var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
let QrService = class QrService {
    tokens = new Map();
    issue(locationId, tripId, ttlSec = 300) {
        const raw = randomBytes(24).toString('hex');
        const t = { id: raw, locationId, tripId, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(), status: 'ACTIVE' };
        this.tokens.set(raw, t);
        return t;
    }
    verify(tokenId, locationId, tripId) {
        const t = this.tokens.get(tokenId);
        if (!t)
            return { ok: false, reason: 'INVALID_TOKEN' };
        if (t.status !== 'ACTIVE')
            return { ok: false, reason: 'TOKEN_NOT_ACTIVE' };
        if (new Date(t.expiresAt).getTime() < Date.now()) {
            t.status = 'EXPIRED';
            return { ok: false, reason: 'EXPIRED' };
        }
        if (t.locationId !== locationId)
            return { ok: false, reason: 'WRONG_LOCATION' };
        if (tripId && t.tripId && t.tripId !== tripId)
            return { ok: false, reason: 'WRONG_TRIP' };
        t.status = 'USED';
        t.usedAt = new Date().toISOString();
        return { ok: true, token: t };
    }
};
QrService = __decorate([
    Injectable()
], QrService);
export { QrService };
//# sourceMappingURL=qr.service.js.map