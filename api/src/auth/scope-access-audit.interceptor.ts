import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { catchError, from, mergeMap, throwError, type Observable } from 'rxjs';
import type { AuthenticatedRequest } from './session.guard.js';
import { classifyScopeAccessDenial } from './scope-access-audit-policy.js';
import { PrismaService } from '../database/prisma.service.js';

type RequestWithRoute = AuthenticatedRequest & Request & {
  route?: { path?: string };
  params: Record<string, string | undefined>;
};

@Injectable()
export class ScopeAccessAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithRoute>();
    return next.handle().pipe(
      catchError((exception: unknown) => {
        const status = typeof (exception as { getStatus?: unknown })?.getStatus === 'function'
          ? (exception as { getStatus: () => number }).getStatus()
          : 0;
        const response = (exception as { getResponse?: () => unknown })?.getResponse?.();
        const code = response && typeof response === 'object' && 'code' in response
          ? String(response.code)
          : undefined;
        const classification = classifyScopeAccessDenial(status, code);
        const principal = request.principal;
        if (!classification || !principal) return throwError(() => exception);

        const entityId = this.getTargetId(request.params);
        return from(this.writeAudit(request, principal.id, classification.outcome, code, entityId)
          .catch(() => undefined)).pipe(
          mergeMap(() => throwError(() => exception)),
        );
      }),
    );
  }

  private writeAudit(
    request: RequestWithRoute,
    actorUserId: string,
    outcome: 'out_of_scope' | 'not_found_or_out_of_scope',
    code: string | undefined,
    entityId: string | null,
  ) {
    const route = request.route?.path ?? '';
    return this.prisma.db.auditLog.create({
      data: {
        actorUserId,
        action: 'security.scope_access.denied',
        entityType: this.getEntityType(route),
        entityId,
        result: 'failure',
        after: {
          outcome,
          code,
          method: request.method,
          route,
        },
        requestId: randomUUID(),
        ipAddress: this.getClientIp(request),
      },
    });
  }

  private getTargetId(params: Record<string, string | undefined> | undefined) {
    if (!params) return null;
    for (const key of ['id', 'tripId', 'exceptionId', 'proofId', 'geofenceId', 'sppgId']) {
      const value = params[key];
      if (value && value.length <= 100) return value;
    }
    return null;
  }

  private getEntityType(route: string) {
    if (route.includes('trip')) return 'trip';
    if (route.includes('exception')) return 'exception';
    if (route.includes('proof')) return 'proof';
    if (route.includes('geofence')) return 'geofence';
    if (route.includes('sppg')) return 'sppg';
    if (route.includes('location')) return 'delivery_location';
    return 'resource';
  }

  private getClientIp(request: Request) {
    const ip = request.ip || request.socket.remoteAddress;
    return ip?.replace(/^::ffff:/, '') ?? null;
  }
}
