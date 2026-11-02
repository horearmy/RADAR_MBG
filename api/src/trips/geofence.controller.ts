import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { CreateGeofenceDto, ListGeofencesDto } from './geofence.dto.js';
import { GeofenceService } from './geofence.service.js';

@Controller('geofences')
@UseGuards(SessionGuard, PermissionGuard)
export class GeofenceController {
  constructor(private readonly geofences: GeofenceService) {}

  @Get()
  @RequirePermissions('geofence:read')
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListGeofencesDto,
  ) {
    return this.geofences.listForLocation(query, request.principal!, request.tenantContext ?? null);
  }

  @Post()
  @RequirePermissions('geofence:manage')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateGeofenceDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    const candidateRequestId = request.get('x-request-id');
    const requestId = candidateRequestId && /^[A-Za-z0-9._:-]{1,100}$/.test(candidateRequestId)
      ? candidateRequestId
      : randomUUID();

    return this.geofences.create(
      input,
      request.principal!,
      idempotencyKey,
      requestId,
      request.tenantContext ?? null,
    );
  }
}
