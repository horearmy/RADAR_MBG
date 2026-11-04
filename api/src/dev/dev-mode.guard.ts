import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Guard untuk endpoint dev-only (DevTools).
 *
 * Aktif bila:
 * - NODE_ENV !== 'production'
 * - DEV_TOOLS_ENABLED === 'true'
 *
 * Bila DEV_TOOLS_TOKEN diset, request wajib membawa header x-dev-token yang sama.
 */
@Injectable()
export class DevModeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const enabled = process.env.DEV_TOOLS_ENABLED === 'true';
    if (nodeEnv === 'production' || !enabled) {
      throw new ForbiddenException({ code: 'DEV_TOOLS_DISABLED' });
    }

    const expectedToken = process.env.DEV_TOOLS_TOKEN;
    if (expectedToken) {
      const request = context.switchToHttp().getRequest<Request>();
      const provided = request.headers['x-dev-token'];
      if (provided !== expectedToken) {
        throw new ForbiddenException({ code: 'DEV_TOKEN_INVALID' });
      }
    }
    return true;
  }
}
