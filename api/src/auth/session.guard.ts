import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { SessionPrincipal } from './auth.service.js';
import { TenantContextResolver } from './tenant-context.resolver.js';
import type { TenantContext } from './tenant-context.js';

export type AuthenticatedRequest = Request & {
  principal?: SessionPrincipal;
  tenantContext?: TenantContext | null;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantContextResolver: TenantContextResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = request.cookies?.radar_session;
    const principal = await this.authService.resolveSession(sessionToken);

    if (!principal) {
      throw new UnauthorizedException({ code: 'SESSION_REQUIRED', message: 'Sesi tidak valid atau telah berakhir.' });
    }

    request.principal = { ...principal, roles: [...principal.roles] };
    const requestedTenantId = request.get('x-tenant-id')?.trim();
    const tenantContext = await this.tenantContextResolver.resolve(principal.id, requestedTenantId || undefined);
    request.tenantContext = tenantContext;
    if (tenantContext) {
      request.principal.roles = request.principal.roles.filter((role) => role.isGlobal);
      request.principal.tenantRole = tenantContext.role;
      request.principal.tenantId = tenantContext.tenantId;
      request.principal.features = tenantContext.features;
      if (tenantContext.sppgId) {
        request.principal.roles.push({
          code: 'TENANT_SCOPE',
          isGlobal: false,
          organizationId: null,
          regionId: null,
          sppgId: tenantContext.sppgId,
          permissions: [],
        });
      }
    } else if (request.principal.hasTenantMemberships && !request.principal.roles.some((role) => role.isGlobal)) {
      request.principal.roles = [];
      request.principal.tenantRole = null;
      request.principal.tenantId = null;
      request.principal.features = null;
    } else if (request.principal.hasTenantMemberships) {
      request.principal.tenantRole = null;
      request.principal.tenantId = null;
      request.principal.features = null;
    }
    return true;
  }
}
