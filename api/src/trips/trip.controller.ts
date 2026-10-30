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
import {
  CancelTripDto,
  ChangeDestinationDto,
  CreateTripDto,
  ListTripsDto,
  ReassignTripDto,
  RescheduleTripDto,
  StartTripDto,
} from './trip.dto.js';
import { GpsPositionDto, TrackQueryDto } from './gps.dto.js';
import { GpsService } from './gps.service.js';
import { TripService } from './trip.service.js';

@Controller('trips')
@UseGuards(SessionGuard, PermissionGuard)
export class TripController {
  constructor(
    private readonly trips: TripService,
    private readonly gps: GpsService,
  ) {}

  @Get()
  @RequirePermissions('trip:read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListTripsDto) {
    return this.trips.listTrips(request.principal!, query, request.tenantContext ?? null);
  }

  @Get(':id')
  @RequirePermissions('trip:read')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.getTrip(id, request.principal!, request.tenantContext ?? null);
  }

  @Post()
  @RequirePermissions('trip:create')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.createTrip(
      input,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
    );
  }

  @Post(':id/schedule')
  @RequirePermissions('trip:schedule')
  schedule(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.scheduleTrip(
      id,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Patch(':id/schedule')
  @RequirePermissions('trip:schedule')
  reschedule(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RescheduleTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.rescheduleTrip(
      id,
      input,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Patch(':id/assignment')
  @RequirePermissions('trip:dispatch')
  reassign(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReassignTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.reassignTrip(
      id,
      input,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Patch(':id/destination')
  @RequirePermissions('trip:manage')
  changeDestination(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ChangeDestinationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.changeDestination(
      id,
      input,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('trip:manage')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CancelTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.cancelTrip(
      id,
      input,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Post(':id/ready-to-depart')
  @RequirePermissions('trip:dispatch')
  ready(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.readyTrip(
      id,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Post(':id/start')
  @RequirePermissions('trip:start')
  start(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: StartTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.startTrip(
      id,
      request.principal!,
      input,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
      request.tenantContext ?? null,
    );
  }

  @Post(':id/locations')
  @RequirePermissions('trip:location:update')
  addLocation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: GpsPositionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.gps.appendPosition(
      id,
      request.principal!,
      input,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
    );
  }

  @Get(':id/track')
  @RequirePermissions('trip:track:read')
  getTrack(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TrackQueryDto,
  ) {
    return this.gps.getTrack(id, request.principal!, query);
  }

  private requireIdempotencyKey(value?: string) {
    if (!value) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    return value;
  }

  private requestId(request: AuthenticatedRequest) {
    const candidate = request.get('x-request-id');
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}
