import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
      role: 'RECIPIENT',
      sites: memberships.map((m) => ({
        id: m.site.id,
        name: m.site.name,
        organizationName: m.site.organization?.name,
      })),
    };
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
        lastLocationAt: null,
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
      lastLocationAt: null,
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
      tripReference: null,
      stopId: null,
    }));
  }

  async markRead(userId: string, id: string) {
    await this.prisma.db.notificationEvent.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
