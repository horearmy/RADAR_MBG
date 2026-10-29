var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let VehiclesService = class VehiclesService {
    vehicles = [
        { id: 'v1', plate: 'B 1234 ABC', type: 'Box', sppgId: 'sppg1', status: 'Tersedia', driver: null },
        { id: 'v2', plate: 'B 5678 DEF', type: 'Pickup', sppgId: 'sppg1', status: 'Bertugas', driver: 'driver1' },
        { id: 'v3', plate: 'D 9012 GHI', type: 'Box', sppgId: 'sppg2', status: 'Perawatan', driver: null },
    ];
    list() { return this.vehicles; }
};
VehiclesService = __decorate([
    Injectable()
], VehiclesService);
export { VehiclesService };
//# sourceMappingURL=vehicles.service.js.map