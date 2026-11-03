import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './session.guard.js';
import { hasPermission, REQUIRED_PERMISSIONS } from './permissions.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Tanpa principal = tidak ada sesi yang valid.
    if (!request.principal) {
      throw new ForbiddenException({
        code: 'PERMISSION_REQUIRED',
        message: 'Izin untuk tindakan ini tidak tersedia.',
      });
    }

    // Endpoint tanpa @RequirePermissions tetap boleh diakses (mis. tenant/summary, tenant/me).
    if (!required?.length) return true;

    const principal = request.principal;
    if (!required.every((permission) => hasPermission(principal, permission))) {
      throw new ForbiddenException({
        code: 'PERMISSION_FORBIDDEN',
        message: 'Anda tidak memiliki izin untuk tindakan ini.',
      });
    }

    return true;
  }
}
