import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { PrivateStorageService } from '../storage/storage.service.js';

@Injectable()
export class RecipientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService,
  ) {}

  private async getMemberships(userId: string) {
    const memberships = await this.prisma.db.recipientMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { site: { include: { organization: true } } },
    });
    return memberships;
  }

  private async ensureMember(userId: string, siteId?: string | null) {
    const memberships = await this.getMemberships(userId);
    if (memberships.length === 0) throw new NotFoundException({ code: 'RECIPIENT_NOT_FOUND' });
    if (siteId && !memberships.some((m) => m.recipientSiteId === siteId)) {
      throw new ForbiddenException({ code: 'SCOPE_FORBIDDEN' });
    }
    return memberships;
  }

  async getMe(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const memberships = await this.getMemberships(userId);
    if (memberships.length === 0) throw new NotFoundException({ code: 'RECIPIENT_NOT_FOUND' });
    return {
      displayName: user.displayName ?? user.username,
      photoUrl: user.photoUrl ?? null,
      role: 'RECIPIENT',
      sites: memberships.map((m) => ({
        id: m.site.id,
        name: m.site.name,
        organizationName: m.site.organization?.name,
      })),
    };
  }

  async updateProfile(userId: string, input: { photoUrl?: string | null }) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const memberships = await this.getMemberships(userId);
    if (memberships.length === 0) throw new NotFoundException({ code: 'RECIPIENT_NOT_FOUND' });
    const updated = await this.prisma.db.user.update({
      where: { id: userId },
      data: { photoUrl: input.photoUrl === undefined ? user.photoUrl : input.photoUrl },
      select: { id: true, username: true, displayName: true, photoUrl: true },
    });
    return updated;
  }

  async listDeliveries(userId: string) {
    const memberships = await this.ensureMember(userId);
    const siteIds = memberships.map((m) => m.recipientSiteId);
    const stops = await this.prisma.db.deliveryStop.findMany({
      where: { recipientSiteId: { in: siteIds } },
      include: {
        site: { include: { organization: true } },
        trip: {
          include: {
            sppg: true,
            deliveryLocation: true,
            vehicle: true,
            driver: true,
            deliveryRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
            positions: { orderBy: { serverReceivedAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { plannedArrivalAt: 'desc' },
    });
    return stops.map((s) => {
      const rec = s.trip.deliveryRecords?.[0];
      return {
        stopId: s.id,
        siteId: s.recipientSiteId,
        tripReference: `TRP-${s.trip.id.slice(0, 8).toUpperCase()}`,
        sppgName: s.trip.sppg?.name ?? null,
        siteName: s.site?.name ?? null,
        status: s.status ?? s.trip.status,
        podStatus: s.trip.deliveryStatus ?? null,
        scheduledAt: s.plannedArrivalAt?.toISOString() ?? s.trip.plannedDepartureAt?.toISOString() ?? null,
        eta: s.trip.plannedArrivalAt?.toISOString() ?? null,
        arrivedAt: s.trip.arrivalVerifiedAt?.toISOString() ?? s.trip.arrivalDetectedAt?.toISOString() ?? null,
        plannedQuantity: s.trip.plannedQuantity ?? null,
        deliveredQuantity: rec?.receivedQuantity ?? s.trip.receivedQuantity ?? null,
        vehiclePlate: s.trip.vehicle?.plateNumber ?? null,
        driverName: s.trip.driver?.name ?? null,
        lastLatitude: s.trip.positions?.[0]?.latitude ? Number(s.trip.positions[0].latitude) : null,
        lastLongitude: s.trip.positions?.[0]?.longitude ? Number(s.trip.positions[0].longitude) : null,
        lastLocationAt: s.trip.positions?.[0]?.serverReceivedAt?.toISOString() ?? null,
        lastLocationAccuracy: s.trip.positions?.[0]?.accuracyMeters ? Number(s.trip.positions[0].accuracyMeters) : null,
      };
    });
  }

  async getStop(userId: string, stopId: string) {
    const stop = await this.prisma.db.deliveryStop.findUnique({
      where: { id: stopId },
      include: {
        site: { include: { organization: true } },
        trip: {
          include: {
            sppg: true,
            deliveryLocation: true,
            vehicle: true,
            driver: true,
            deliveryRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
            positions: { orderBy: { serverReceivedAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!stop) throw new NotFoundException({ code: 'STOP_NOT_FOUND' });
    await this.ensureMember(userId, stop.recipientSiteId);
    const rec = stop.trip.deliveryRecords?.[0];
    return {
      stopId: stop.id,
      siteId: stop.recipientSiteId,
      tripReference: `TRP-${stop.trip.id.slice(0, 8).toUpperCase()}`,
      sppgName: stop.trip.sppg?.name ?? null,
      siteName: stop.site?.name ?? null,
      status: stop.status ?? stop.trip.status,
      podStatus: stop.trip.deliveryStatus ?? null,
      scheduledAt: stop.plannedArrivalAt?.toISOString() ?? stop.trip.plannedDepartureAt?.toISOString() ?? null,
      eta: stop.trip.plannedArrivalAt?.toISOString() ?? null,
      arrivedAt: stop.trip.arrivalVerifiedAt?.toISOString() ?? stop.trip.arrivalDetectedAt?.toISOString() ?? null,
      plannedQuantity: stop.trip.plannedQuantity ?? null,
      deliveredQuantity: rec?.receivedQuantity ?? stop.trip.receivedQuantity ?? null,
      vehiclePlate: stop.trip.vehicle?.plateNumber ?? null,
      driverName: stop.trip.driver?.name ?? null,
      sppgLatitude: stop.trip.sppg?.latitude ? Number(stop.trip.sppg.latitude) : null,
      sppgLongitude: stop.trip.sppg?.longitude ? Number(stop.trip.sppg.longitude) : null,
      deliveryLatitude: stop.trip.deliveryLocation?.latitude ? Number(stop.trip.deliveryLocation.latitude) : null,
      deliveryLongitude: stop.trip.deliveryLocation?.longitude ? Number(stop.trip.deliveryLocation.longitude) : null,
      lastLatitude: stop.trip.positions?.[0]?.latitude ? Number(stop.trip.positions[0].latitude) : null,
      lastLongitude: stop.trip.positions?.[0]?.longitude ? Number(stop.trip.positions[0].longitude) : null,
      lastLocationAt: stop.trip.positions?.[0]?.serverReceivedAt?.toISOString() ?? null,
      lastLocationAccuracy: stop.trip.positions?.[0]?.accuracyMeters ? Number(stop.trip.positions[0].accuracyMeters) : null,
    };
  }

  async getPod(userId: string, stopId: string) {
    const stop = await this.prisma.db.deliveryStop.findUnique({
      where: { id: stopId },
      include: {
        site: true,
        trip: {
          include: {
            sppg: true,
            deliveryLocation: true,
            driver: true,
            deliveryRecords: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { proofs: { orderBy: { uploadedAt: 'desc' }, take: 1 } },
            },
          },
        },
      },
    });
    if (!stop) throw new NotFoundException({ code: 'STOP_NOT_FOUND' });
    await this.ensureMember(userId, stop.recipientSiteId);
    const rec = stop.trip.deliveryRecords?.[0];
    const proof = rec?.proofs?.[0];
    let photoUrl: string | null = null;
    if (proof?.objectKey && this.storage.configured) {
      try {
        photoUrl = await this.storage.signedDownloadUrl(proof.objectKey, 300);
      } catch {
        photoUrl = null;
      }
    }
    return {
      stopId: stop.id,
      tripReference: `TRP-${stop.trip.id.slice(0, 8).toUpperCase()}`,
      siteName: stop.site?.name ?? null,
      sppgName: stop.trip.sppg?.name ?? null,
      driverName: stop.trip.driver?.name ?? null,
      submittedAt: rec?.createdAt?.toISOString() ?? null,
      deliveredQuantity: rec?.receivedQuantity ?? stop.trip.receivedQuantity ?? null,
      receiverName: null,
      note: rec?.confirmationNote ?? null,
      photoUrl,
      status: rec?.reviewStatus ?? stop.trip.deliveryStatus ?? null,
    };
  }

  async confirm(userId: string, stopId: string) {
    const stop = await this.prisma.db.deliveryStop.findUnique({ where: { id: stopId } });
    if (!stop) throw new NotFoundException({ code: 'STOP_NOT_FOUND' });
    await this.ensureMember(userId, stop.recipientSiteId);
    await this.prisma.db.deliveryStop.update({
      where: { id: stopId },
      data: { status: 'CONFIRMED' },
    });
    return { ok: true };
  }

  async reportIssue(userId: string, stopId: string, input: { category: string; description: string }) {
    const stop = await this.prisma.db.deliveryStop.findUnique({ where: { id: stopId } });
    if (!stop) throw new NotFoundException({ code: 'STOP_NOT_FOUND' });
    await this.ensureMember(userId, stop.recipientSiteId);
    await this.prisma.db.deliveryStop.update({
      where: { id: stopId },
      data: { status: 'ISSUE_REPORTED' },
    });
    return { reference: `ISS-${stopId.slice(0, 8).toUpperCase()}` };
  }

  async listNotifications(userId: string) {
    const rows = await this.prisma.db.notificationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((n) => ({
      id: n.id,
      category: n.type,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
      tripReference: n.tripId ? `TRP-${n.tripId.slice(0, 8).toUpperCase()}` : null,
      stopId: n.stopId,
    }));
  }

  /** Buat notifikasi saat status trip berubah (untuk recipient). */
  async notifyTripStatusChange(tripId: string, status: string) {
    const stops = await this.prisma.db.deliveryStop.findMany({
      where: { tripId },
      include: { site: { include: { memberships: { where: { status: 'ACTIVE' } } } } },
    });
    const trip = await this.prisma.db.trip.findUnique({ where: { id: tripId } });
    const tripRef = `TRP-${tripId.slice(0, 8).toUpperCase()}`;
    const titleMap: Record<string, string> = {
      IN_TRANSIT: 'Kendaraan dalam perjalanan',
      ARRIVAL_DETECTED: 'Kendaraan mendekati lokasi',
      ARRIVAL_VERIFIED: 'Kendaraan tiba di lokasi',
      DELIVERED: 'POD telah dikirim',
      COMPLETED: 'Pengiriman selesai',
    };
    const title = titleMap[status] ?? `Status perjalanan: ${status}`;
    const notifications = stops.flatMap((stop) =>
      stop.site.memberships.map((m) => ({
        userId: m.userId,
        type: status === 'DELIVERED' ? 'POD_SUBMITTED' : 'SCHEDULE_CHANGED',
        title,
        body: `Perjalanan ${tripRef} · ${stop.site.name}`,
        status: 'SENT',
        stopId: stop.id,
        tripId,
      })),
    );
    if (notifications.length > 0) {
      const existing = await this.prisma.db.notificationEvent.findMany({
        where: { tripId, stopId: { in: notifications.map((n) => n.stopId).filter((id): id is string => Boolean(id)) } },
        select: { userId: true, stopId: true, type: true },
      });
      const existingKeys = new Set(existing.map((n) => `${n.userId}:${n.stopId}:${n.type}`));
      const unique = notifications.filter((n) => !existingKeys.has(`${n.userId}:${n.stopId}:${n.type}`));
      if (unique.length > 0) {
        await this.prisma.db.notificationEvent.createMany({ data: unique });
      }
    }
  }

  async markRead(userId: string, id: string) {
    await this.prisma.db.notificationEvent.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async createReview(userId: string, stopId: string, input: { rating: number; emoji?: string; comment?: string }) {
    const stop = await this.prisma.db.deliveryStop.findUnique({ where: { id: stopId } });
    if (!stop) throw new NotFoundException({ code: 'STOP_NOT_FOUND' });
    await this.ensureMember(userId, stop.recipientSiteId);

    if (input.rating < 1 || input.rating > 5) throw new BadRequestException({ code: 'INVALID_RATING' });

    return this.prisma.db.recipientReview.create({
      data: {
        userId,
        recipientSiteId: stop.recipientSiteId,
        tripId: stop.tripId,
        stopId,
        rating: input.rating,
        emoji: input.emoji?.trim() ?? null,
        comment: input.comment?.trim() ?? null,
        status: 'SUBMITTED',
      },
    });
  }

  async getReview(userId: string, stopId: string) {
    const stop = await this.prisma.db.deliveryStop.findUnique({ where: { id: stopId } });
    if (!stop) throw new NotFoundException({ code: 'STOP_NOT_FOUND' });
    await this.ensureMember(userId, stop.recipientSiteId);
    return this.prisma.db.recipientReview.findUnique({ where: { userId_stopId: { userId, stopId } } });
  }

  async listReviews(userId: string) {
    return this.prisma.db.recipientReview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateReview(userId: string, reviewId: string, input: { rating?: number; emoji?: string; comment?: string }) {
    const review = await this.prisma.db.recipientReview.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) throw new BadRequestException({ code: 'INVALID_RATING' });
    return this.prisma.db.recipientReview.update({
      where: { id: reviewId },
      data: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.emoji !== undefined ? { emoji: input.emoji?.trim() ?? null } : {}),
        ...(input.comment !== undefined ? { comment: input.comment?.trim() ?? null } : {}),
      },
    });
  }

  async deleteReview(userId: string, reviewId: string) {
    const review = await this.prisma.db.recipientReview.findUnique({ where: { id: reviewId } });
    if (!review || review.userId !== userId) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND' });
    await this.prisma.db.recipientReview.delete({ where: { id: reviewId } });
    return { ok: true };
  }
}
