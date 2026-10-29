var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let LocationsService = class LocationsService {
    locs = [
        { id: 'loc1', name: 'Sekolah Dasar 1', address: 'Jl. Pendidikan 1', region: 'Jakarta Pusat', lat: -6.18, lon: 106.84, geofenceId: 'gf1' },
        { id: 'loc2', name: 'Puskesmas Bandung', address: 'Jl. Kesehatan 2', region: 'Bandung', lat: -6.92, lon: 107.62, geofenceId: null },
    ];
    list() { return this.locs; }
};
LocationsService = __decorate([
    Injectable()
], LocationsService);
export { LocationsService };
//# sourceMappingURL=locations.service.js.map