import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { TenantGuard } from '../auth/tenant.guard.js';
import { ArrivalService } from './arrival.service.js';
import { IssueQrTokenDto, OverrideArrivalDto, VerifyArrivalDto } from './arrival.dto.js';

@Controller('trips/:tripId')
@UseGuards(SessionGuard, TenantGuard, PermissionGuard)
export class ArrivalController {
  constructor(private readonly arrivals: ArrivalService) {}

  @Post('qr-token')
  @RequirePermissions('arrival:qr:issue')
  issueQrToken(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() input: IssueQrTokenDto,
  ) {
    return this.arrivals.issueQrToken(
      tripId,
      request.principal!,
      input,
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Post('arrival/verify')
  @RequirePermissions('arrival:verify')
  verifyArrival(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() input: VerifyArrivalDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return this.arrivals.verifyArrival(
      tripId,
      request.principal!,
      input,
      idempotencyKey,
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Post('arrival/override')
  @RequirePermissions('arrival:override')
  overrideArrival(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() input: OverrideArrivalDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return this.arrivals.overrideArrival(
      tripId,
      request.principal!,
      input,
      idempotencyKey,
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  private requestId(request: AuthenticatedRequest) {
    const candidate = request.get('x-request-id');
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}
