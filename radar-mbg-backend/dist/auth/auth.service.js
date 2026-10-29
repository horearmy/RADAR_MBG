var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
let AuthService = class AuthService {
    jwt;
    users = [];
    constructor(jwt) {
        this.jwt = jwt;
        this.users.push({ id: 'u1', username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10), role: 'SUPER_ADMIN', orgId: 'org1' });
        this.users.push({ id: 'u2', username: 'driver1', passwordHash: bcrypt.hashSync('driver123', 10), role: 'DRIVER', orgId: 'org1' });
    }
    async login(username, password) {
        const u = this.users.find(x => x.username === username);
        if (!u || !(await bcrypt.compare(password, u.passwordHash)))
            throw new UnauthorizedException('Invalid credentials');
        const token = this.jwt.sign({ sub: u.id, role: u.role, orgId: u.orgId });
        return { accessToken: token, user: { id: u.id, username: u.username, role: u.role, orgId: u.orgId } };
    }
    validate(payload) {
        return { userId: payload.sub, role: payload.role, orgId: payload.orgId };
    }
};
AuthService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [typeof (_a = typeof JwtService !== "undefined" && JwtService) === "function" ? _a : Object])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map