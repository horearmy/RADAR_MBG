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
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { PodService } from './pod.service.js';
let PodController = class PodController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    submit(id, b) { return this.svc.submit({ tripId: id, ...b }); }
    list(id) { return this.svc.list(id); }
};
__decorate([
    Post(':id/pod'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PodController.prototype, "submit", null);
__decorate([
    Get(':id/pod'),
    __param(0, Param('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PodController.prototype, "list", null);
PodController = __decorate([
    Controller('api/v1/trips'),
    __metadata("design:paramtypes", [PodService])
], PodController);
export { PodController };
let PodReviewController = class PodReviewController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    review(id, b) { return this.svc.review(id, b.status); }
};
__decorate([
    Post(':id/review'),
    __param(0, Param('id')),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PodReviewController.prototype, "review", null);
PodReviewController = __decorate([
    Controller('api/v1/pod'),
    __metadata("design:paramtypes", [PodService])
], PodReviewController);
export { PodReviewController };
//# sourceMappingURL=pod.controller.js.map