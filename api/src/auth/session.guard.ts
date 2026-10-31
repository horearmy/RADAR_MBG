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
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Sesi tidak valid atau telah berakhir.',
      });
    }

    request.principal = principal;
    const tenantContext = await this.tenantContextResolver.resolve(principal.id);
    request.tenantContext = tenantContext;
    if (tenantContext) {
      request.principal.tenantRole = tenantContext.role;
    }
    return true;
  }
}
