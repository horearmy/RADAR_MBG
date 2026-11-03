import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { DevModeGuard } from './dev-mode.guard.js';
import { DeliveryStatus, Prisma, TrackingStatus, TripStatus, ArrivalVerificationStatus } from '@prisma/client';

const DEV_TRIP_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'READY_TO_DEPART',
  'IN_TRANSIT',
  'ARRIVAL_DETECTED',
  'ARRIVAL_VERIFIED',
  'DELIVERY_IN_PROGRESS',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'EXCEPTION',
] as const;

type DevTripStatus = (typeof DEV_TRIP_STATUSES)[number];

function isDevTripStatus(value: string): value is DevTripStatus {
  return (DEV_TRIP_STATUSES as readonly string[]).includes(value);
}

/**
 * Controller khusus development untuk membantu testing fitur.
 * Hanya aktif saat DEV_TOOLS_ENABLED=true dan NODE_ENV !== 'production'.
 */
@Controller('dev')
@UseGuards(SessionGuard, DevModeGuard)
export class DevController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('trips')
  listTrips(@Req() request: AuthenticatedRequest) {
    const userId = request.principal!.id;
    return this.prisma.db.trip.findMany({
      where: {
        OR: [
          { driver: { userId } },
          { createdBy: userId },
        ],
      },
      orderBy: { plannedDepartureAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        trackingStatus: true,
        verificationStatus: true,
        deliveryStatus: true,
        plannedQuantity: true,
        dispatchedQuantity: true,
        plannedDepartureAt: true,
        deliveryLocation: { select: { name: true } },
        driver: { select: { name: true } },
      },
    });
  }

  @Post('trips/:id/status')
  async setTripStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: string },
  ) {
    const status = body?.status ?? '';
    if (!isDevTripStatus(status)) {
      return { ok: false, error: 'INVALID_STATUS', allowed: DEV_TRIP_STATUSES };
    }

    const userId = request.principal!.id;
    const trip = await this.prisma.db.trip.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        plannedQuantity: true,
        dispatchedQuantity: true,
        driver: { select: { userId: true } },
        version: true,
      },
    });
    if (!trip) return { ok: false, error: 'TRIP_NOT_FOUND' };
    if (trip.driver?.userId !== userId) {
      return { ok: false, error: 'NOT_YOUR_TRIP' };
    }

    const now = new Date();
    const data: Prisma.TripUpdateInput = {
      status: status as TripStatus,
      version: { increment: 1 },
    };

    // Sinkronkan status turunan agar UI konsisten.
    if (status === 'IN_TRANSIT' || status === 'ARRIVAL_DETECTED' || status === 'ARRIVAL_VERIFIED' || status === 'DELIVERY_IN_PROGRESS') {
      data.trackingStatus = TrackingStatus.LIVE;
      if (status === 'DELIVERY_IN_PROGRESS') {
        data.deliveryStatus = DeliveryStatus.IN_PROGRESS;
        data.deliveryStartedAt = now;
        // Pastikan dispatchedQuantity terisi untuk form POD.
        if (trip.dispatchedQuantity === null || trip.dispatchedQuantity === undefined) {
          data.dispatchedQuantity = trip.plannedQuantity;
        }
      }
      if (status === 'ARRIVAL_VERIFIED' || status === 'DELIVERY_IN_PROGRESS') {
        data.verificationStatus = ArrivalVerificationStatus.VERIFIED;
      }
    } else if (status === 'DELIVERED') {
      data.deliveryStatus = DeliveryStatus.UNDER_REVIEW;
      data.trackingStatus = TrackingStatus.ENDED;
    } else if (status === 'COMPLETED') {
      data.trackingStatus = TrackingStatus.ENDED;
      data.completedAt = now;
    } else if (status === 'CANCELLED' || status === 'EXCEPTION') {
      data.trackingStatus = TrackingStatus.ENDED;
    }

    await this.prisma.db.trip.update({
      where: { id },
      data,
    });

    return { ok: true, tripId: id, status, previousStatus: trip.status, version: trip.version + 1 };
  }
}
