import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { SessionPrincipal } from './auth.service.js';

export type AuthenticatedRequest = Request & { principal?: SessionPrincipal };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

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
    return true;
  }
}
