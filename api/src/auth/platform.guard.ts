import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './session.guard.js';

/**
 * Allows access only to principals holding at least one global (platform) role.
 * Tenant-scoped roles never satisfy this guard.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.principal;

    if (!principal?.roles?.some((role) => role.isGlobal)) {
      throw new ForbiddenException({
        code: 'PLATFORM_FORBIDDEN',
        message: 'Akses platform hanya untuk administrator platform.',
      });
    }

    return true;
  }
}
