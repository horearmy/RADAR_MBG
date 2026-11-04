import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { TenantGuard } from '../auth/tenant.guard.js';
import { CreateRouteDto, ListRoutesDto } from './route.dto.js';
import { RouteService } from './route.service.js';

@Controller('routes')
@UseGuards(SessionGuard, TenantGuard, PermissionGuard)
export class RouteController {
  constructor(private readonly routes: RouteService) {}

  @Get()
  @RequirePermissions('route:read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListRoutesDto) {
    return this.routes.list(request.principal!, query, request.tenantContext ?? null);
  }

  @Get(':id')
  @RequirePermissions('route:read')
  getOne(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.routes.getById(id, request.principal!, request.tenantContext ?? null);
  }

  @Post()
  @RequirePermissions('route:manage')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateRouteDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    const candidateRequestId = request.get('x-request-id');
    const requestId = candidateRequestId && /^[A-Za-z0-9._:-]{1,100}$/.test(candidateRequestId)
      ? candidateRequestId
      : randomUUID();
    return this.routes.create(input, request.principal!, idempotencyKey, requestId, request.tenantContext ?? null);
  }

  @Patch(':id/archive')
  @RequirePermissions('route:manage')
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: { reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    const candidateRequestId = request.get('x-request-id');
    const requestId = candidateRequestId && /^[A-Za-z0-9._:-]{1,100}$/.test(candidateRequestId)
      ? candidateRequestId
      : randomUUID();
    return this.routes.archive(id, input.reason, request.principal!, idempotencyKey, requestId, request.tenantContext ?? null);
  }
}
