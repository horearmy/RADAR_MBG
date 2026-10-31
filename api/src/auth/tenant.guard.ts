import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthenticatedRequest } from './session.guard.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.tenantContext) {
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
    return true;
  }
}
