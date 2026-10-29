var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let SppgService = class SppgService {
    sppgs = [
        { id: 'sppg1', code: 'SPPG-JKT-001', name: 'SPPG Jakarta Pusat', region: 'DKI Jakarta', address: 'Jl. Medan Merdeka, Jakarta Pusat', lat: -6.17, lon: 106.83, status: 'Aktif', pic: 'Budi Santoso', drivers: 5, vehicles: 3, distributionToday: 12, updatedAt: new Date().toISOString() },
        { id: 'sppg2', code: 'SPPG-BDG-002', name: 'SPPG Bandung', region: 'Jawa Barat', address: 'Jl. Asia Afrika, Bandung', lat: -6.91, lon: 107.61, status: 'Perlu Perhatian', pic: 'Siti Aminah', drivers: 3, vehicles: 2, distributionToday: 4, updatedAt: new Date().toISOString() },
        { id: 'sppg3', code: 'SPPG-SBY-003', name: 'SPPG Surabaya', region: 'Jawa Timur', address: 'Jl. Tunjungan, Surabaya', lat: -7.25, lon: 112.75, status: 'Nonaktif', pic: 'Andi Wijaya', drivers: 0, vehicles: 0, distributionToday: 0, updatedAt: new Date().toISOString() },
    ];
    list() { return this.sppgs; }
    create(s) { const n = { id: `sppg_${Date.now()}`, ...s, updatedAt: new Date().toISOString() }; this.sppgs.push(n); return n; }
    kpi() {
        return {
            total: this.sppgs.length,
            active: this.sppgs.filter(s => s.status === 'Aktif').length,
            attention: this.sppgs.filter(s => s.status === 'Perlu Perhatian').length,
            inactive: this.sppgs.filter(s => s.status === 'Nonaktif').length,
            distributionToday: this.sppgs.reduce((a, s) => a + s.distributionToday, 0),
        };
    }
};
SppgService = __decorate([
    Injectable()
], SppgService);
export { SppgService };
//# sourceMappingURL=sppg.service.js.map