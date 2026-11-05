import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedRequest } from './session.guard.js';

const TENANT_REQUIRED = 'radar:tenant-required';

export function RequireTenant() {
  return SetMetadata(TENANT_REQUIRED, true);
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.tenantContext) {
      const isGlobal = req.principal?.roles.some((role) => role.isGlobal) ?? false;
      if (isGlobal && req.principal?.id) {
        this.prisma.db.auditLog.create({
          data: {
            actorUserId: req.principal.id,
            action: 'tenant.support_access',
            entityType: 'tenant',
            entityId: req.tenantContext.tenantId,
            result: 'SUCCESS',
            reason: 'Platform admin mengakses tenant context.',
          },
        }).catch(() => {});
      }
      return true;
    }

    const requiresTenant = this.reflector.getAllAndOverride<boolean>(TENANT_REQUIRED, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isGlobal = req.principal?.roles.some((role) => role.isGlobal) ?? false;
    if (isGlobal && !requiresTenant) return true;

    if (req.principal?.id) {
      this.prisma.db.auditLog.create({
        data: {
          actorUserId: req.principal.id,
          action: 'tenant.access.denied',
          entityType: 'tenant',
          result: 'DENIED',
          reason: 'Tenant context not available',
        },
      }).catch(() => {});
    }
    throw new ForbiddenException({ code: 'TENANT_REQUIRED', message: 'Tenant context tidak tersedia.' });
  }
}
