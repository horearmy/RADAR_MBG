import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from './session.guard.js';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.tenantContext) {
      throw new ForbiddenException({ code: 'TENANT_REQUIRED', message: 'Tenant context tidak tersedia.' });
    }
    return true;
  }
}
