import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PermissionGuard } from './permission.guard.js';
import { SessionGuard } from './session.guard.js';
import { TenantContextResolver } from './tenant-context.resolver.js';
import { TenantGuard } from './tenant.guard.js';
import { ScopeAccessAuditInterceptor } from './scope-access-audit.interceptor.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionGuard,
    TenantContextResolver,
    TenantGuard,
    PermissionGuard,
    { provide: APP_INTERCEPTOR, useClass: ScopeAccessAuditInterceptor },
  ],
  exports: [AuthService, SessionGuard, TenantContextResolver, TenantGuard, PermissionGuard],
})
export class AuthModule {}
