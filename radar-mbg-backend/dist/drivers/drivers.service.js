var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let DriversService = class DriversService {
    drivers = [
        { id: 'driver1', name: 'Budi Driver', username: 'driver1', sppgId: 'sppg1', vehicle: 'B 5678 DEF', status: 'Aktif', availability: 'Bertugas' },
    ];
    list() { return this.drivers; }
    create(d) { const n = { id: `drv_${Date.now()}`, ...d }; this.drivers.push(n); return n; }
};
DriversService = __decorate([
    Injectable()
], DriversService);
export { DriversService };
//# sourceMappingURL=drivers.service.js.map