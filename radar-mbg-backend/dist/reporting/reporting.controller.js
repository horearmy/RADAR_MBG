var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Get, Query } from '@nestjs/common';
let ReportingController = class ReportingController {
    trips(q) {
        return { message: 'Trip report placeholder', filters: q, generatedAt: new Date().toISOString() };
    }
    summary() {
        return { tripsToday: 0, inTransit: 0, verifiedArrivals: 0, delivered: 0, late: 0, staleTracking: 0, activeAlerts: 0 };
    }
};
__decorate([
    Get('trips'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReportingController.prototype, "trips", null);
__decorate([
    Get('dashboard/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReportingController.prototype, "summary", null);
ReportingController = __decorate([
    Controller('api/v1/reports')
], ReportingController);
export { ReportingController };
//# sourceMappingURL=reporting.controller.js.map