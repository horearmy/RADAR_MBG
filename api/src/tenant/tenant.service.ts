import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { EmailService } from './email.service.js';
import type { FeaturesConfig } from './tenant-features.controller.js';
import * as argon2 from 'argon2';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  async summary(tenantId: string) {
    // Hitung rentang hari ini berdasarkan WIB (UTC+7)
    const now = new Date();
    const wibOffsetMs = 7 * 60 * 60 * 1000;
    const wibNow = new Date(now.getTime() + wibOffsetMs);
    const start = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()) - wibOffsetMs);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const [drivers, vehicles, tripsToday, tripsActive, tripsDone] = await Promise.all([
      this.prisma.db.driver.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.db.vehicle.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.db.trip.count({ where: { tenantId, plannedDepartureAt: { gte: start, lt: end } } }),
      this.prisma.db.trip.count({ where: { tenantId, status: { in: ['IN_TRANSIT', 'DELIVERY_IN_PROGRESS', 'ARRIVAL_DETECTED', 'ARRIVAL_VERIFIED'] } } }),
      this.prisma.db.trip.count({ where: { tenantId, status: 'COMPLETED' } }),
    ]);
    return { drivers, vehicles, tripsToday, tripsActive, tripsDone };
  }

  async getMe(tenantId: string) {
    return this.prisma.db.tenant.findUnique({
      where: { id: tenantId },
      include: { profile: true },
    });
  }

  async updateProfile(tenantId: string, actorUserId: string, data: {
    sppgName?: string;
    fullAddress?: string;
    contactPhone?: string;
    provinceCode?: string;
    regencyCode?: string;
    districtCode?: string;
    villageCode?: string;
    personInCharge?: string;
    operationalHours?: string;
    capacity?: number | null;
    notes?: string;
    latitude?: string;
    longitude?: string;
    reason?: string;
  }) {
    const updated = await this.prisma.db.sppgProfile.update({
      where: { tenantId },
      data: {
        ...(data.sppgName !== undefined ? { sppgName: data.sppgName } : {}),
        ...(data.fullAddress !== undefined ? { fullAddress: data.fullAddress } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
        ...(data.provinceCode !== undefined ? { provinceCode: data.provinceCode } : {}),
        ...(data.regencyCode !== undefined ? { regencyCode: data.regencyCode } : {}),
        ...(data.districtCode !== undefined ? { districtCode: data.districtCode } : {}),
        ...(data.villageCode !== undefined ? { villageCode: data.villageCode } : {}),
        ...(data.personInCharge !== undefined ? { personInCharge: data.personInCharge } : {}),
        ...(data.operationalHours !== undefined ? { operationalHours: data.operationalHours } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      },
    });
    await this.prisma.db.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: 'tenant.profile.update',
        entityType: 'sppg_profile',
        entityId: updated.id,
        result: 'SUCCESS',
        reason: data.reason ?? null,
      },
    });
    return updated;
  }

  private async legacySppg(tenantId: string) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.legacySppgId) throw new Error('TENANT_SPPG_NOT_LINKED');
    return tenant.legacySppgId;
  }

  async listDrivers(tenantId: string) {
    return this.prisma.db.driver.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, phone: true, status: true },
    });
  }

  async createDriver(tenantId: string, input: { code: string; name: string; phone?: string }) {
    const sppgId = await this.legacySppg(tenantId);
    return this.prisma.db.driver.create({
      data: { tenantId, sppgId, code: input.code.trim().toUpperCase(), name: input.name.trim(), phone: input.phone?.trim(), status: 'ACTIVE' },
    });
  }

async createDeliveryLocation(tenantId: string, input: { code: string; name: string; address?: string; latitude?: number; longitude?: number }) {
    const sppgId = await this.legacySppg(tenantId);
    const sppg = await this.prisma.db.sppg.findUnique({ where: { id: sppgId } });
    if (!sppg) throw new Error('SPPG_NOT_FOUND');

    return this.prisma.db.deliveryLocation.create({
      data: {
        organizationId: sppg.organizationId,
        regionId: sppg.regionId,
        tenantId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        address: input.address?.trim() ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        active: true,
      },
    });
  }

async getDeliveryLocation(tenantId: string, id: string) {
    const sppgId = await this.legacySppg(tenantId);
    const sppg = await this.prisma.db.sppg.findUnique({ where: { id: sppgId } });
    if (!sppg) throw new Error('SPPG_NOT_FOUND');
    const loc = await this.prisma.db.deliveryLocation.findFirst({
      where: { id, organizationId: sppg.organizationId },
    });
    if (!loc) throw new Error('LOCATION_NOT_FOUND');
    return loc;
  }

  async updateDeliveryLocation(tenantId: string, id: string, data: { name?: string; address?: string; latitude?: number; longitude?: number; active?: boolean }) {
    const sppgId = await this.legacySppg(tenantId);
    const sppg = await this.prisma.db.sppg.findUnique({ where: { id: sppgId } });
    if (!sppg) throw new Error('SPPG_NOT_FOUND');
    const loc = await this.prisma.db.deliveryLocation.findFirst({
      where: { id, organizationId: sppg.organizationId },
    });
    if (!loc) throw new Error('LOCATION_NOT_FOUND');
    return this.prisma.db.deliveryLocation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.address !== undefined ? { address: data.address.trim() || null } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async listDeliveryLocations(tenantId: string) {
    const sppgId = await this.legacySppg(tenantId);
    const sppg = await this.prisma.db.sppg.findUnique({ where: { id: sppgId } });
    if (!sppg) return [];
    return this.prisma.db.deliveryLocation.findMany({
      where: { organizationId: sppg.organizationId, regionId: sppg.regionId },
      select: { id: true, code: true, name: true, address: true, latitude: true, longitude: true, active: true },
      orderBy: { name: 'asc' },
    });
  }

  async createTrip(tenantId: string, principal: { id: string }, input: {
    deliveryLocationId: string;
    vehicleId: string;
    driverId: string;
    plannedDepartureAt: string;
    plannedArrivalAt: string;
    plannedQuantity: number;
  }) {
    const sppgId = await this.legacySppg(tenantId);
    const sppg = await this.prisma.db.sppg.findUnique({ where: { id: sppgId } });
    if (!sppg) throw new Error('SPPG_NOT_FOUND');

    const vehicle = await this.prisma.db.vehicle.findFirst({ where: { id: input.vehicleId, tenantId } });
    if (!vehicle) throw new Error('VEHICLE_NOT_AVAILABLE');

    const driver = await this.prisma.db.driver.findFirst({ where: { id: input.driverId, tenantId } });
    if (!driver) throw new Error('DRIVER_NOT_AVAILABLE');

    const deliveryLocation = await this.prisma.db.deliveryLocation.findFirst({ where: { id: input.deliveryLocationId, organizationId: sppg.organizationId } });
    if (!deliveryLocation) throw new Error('INVALID_DESTINATION');

    const trip = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          tenantId,
          organizationId: sppg.organizationId,
          sppgId,
          createdBy: principal.id,
          deliveryLocationId: input.deliveryLocationId,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          plannedDepartureAt: new Date(input.plannedDepartureAt),
          plannedArrivalAt: new Date(input.plannedArrivalAt),
          plannedQuantity: input.plannedQuantity,
          status: 'SCHEDULED',
          version: 1,
        },
      });

      // Buat DeliveryStop untuk recipient site yang terkait dengan delivery location
      const recipientSite = await tx.recipientSite.findFirst({
        where: { deliveryLocationId: input.deliveryLocationId, active: true },
      });
      if (recipientSite) {
        await tx.deliveryStop.create({
          data: {
            tripId: created.id,
            recipientSiteId: recipientSite.id,
            sequenceNumber: 1,
            plannedArrivalAt: new Date(input.plannedArrivalAt),
            status: 'PENDING',
          },
        });
      }

      return created;
    });

    return trip;
  }

  async listVehicles(tenantId: string) {
    return this.prisma.db.vehicle.findMany({
      where: { tenantId },
      orderBy: { plateNumber: 'asc' },
      select: { id: true, plateNumber: true, label: true, capacity: true, status: true },
    });
  }

  async createVehicle(tenantId: string, input: { plateNumber: string; label?: string; capacity?: number }) {
    const sppgId = await this.legacySppg(tenantId);
    const sppg = await this.prisma.db.sppg.findUnique({ where: { id: sppgId } });
    if (!sppg) throw new Error('SPPG_NOT_FOUND');
    return this.prisma.db.vehicle.create({
      data: {
        tenantId,
        organizationId: sppg.organizationId,
        sppgId,
        plateNumber: input.plateNumber.trim().toUpperCase(),
        label: input.label?.trim(),
        capacity: input.capacity,
        status: 'ACTIVE',
      },
    });
  }

  async listAudit(tenantId: string) {
    return this.prisma.db.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, action: true, entityType: true, entityId: true, result: true, createdAt: true },
    });
  }

  async listTrips(tenantId: string) {
    return this.prisma.db.trip.findMany({
      where: { tenantId },
      orderBy: { plannedDepartureAt: 'desc' },
      take: 50,
      select: {
        id: true, status: true, plannedDepartureAt: true, plannedArrivalAt: true, plannedQuantity: true,
        trackingStatus: true, verificationStatus: true,
        driver: { select: { name: true } },
        vehicle: { select: { plateNumber: true } },
        deliveryLocation: { select: { name: true, address: true, latitude: true, longitude: true } },
        sppg: { select: { name: true } },
        positions: {
          select: { latitude: true, longitude: true, serverReceivedAt: true, accuracyMeters: true },
          orderBy: { serverReceivedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async bulkAssignRole(tenantId: string, userIds: string[], role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER') {
    await this.prisma.db.tenantMembership.updateMany({
      where: { tenantId, userId: { in: userIds } },
      data: { role },
    });
    return { updated: userIds.length };
  }

  async bulkUpdateStatus(tenantId: string, userIds: string[], status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE') {
    await this.prisma.db.tenantMembership.updateMany({
      where: { tenantId, userId: { in: userIds } },
      data: { status },
    });
    await this.prisma.db.user.updateMany({
      where: { id: { in: userIds } },
      data: { status },
    });
    return { updated: userIds.length };
  }

async createUser(tenantId: string, username: string, displayName: string, password: string, role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER', driverId: string | undefined, invitedByUserId: string) {
    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.db.user.create({
      data: {
        username: username.trim().toLowerCase(),
        displayName: displayName.trim() || username.trim(),
        passwordHash,
        status: 'ACTIVE',
        passwordChangedAt: new Date(),
        ...(driverId ? { driver: { connect: { id: driverId } } } : {}),
      },
    });
    const membership = await this.prisma.db.tenantMembership.create({
      data: {
        tenantId,
        userId: user.id,
        role,
        status: 'ACTIVE',
        invitedByUserId,
      },
    });
    return { user, membership };
  }

async getUser(tenantId: string, userId: string) {
    const membership = await this.prisma.db.tenantMembership.findFirst({
      where: { tenantId, userId },
      include: { user: { select: { id: true, username: true, displayName: true, status: true, driver: { select: { id: true, code: true, name: true } } } } },
    });
    if (!membership) throw new Error('USER_NOT_FOUND');
    return { ...membership.user, role: membership.role, membershipId: membership.id, membershipStatus: membership.status };
  }

  async updateUser(tenantId: string, userId: string, data: { displayName?: string; role?: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER'; status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'; password?: string }, actorUserId: string) {
    const membership = await this.prisma.db.tenantMembership.findFirst({
      where: { tenantId, userId },
    });
    if (!membership) throw new Error('USER_NOT_FOUND');

    if (data.displayName !== undefined || data.password !== undefined) {
      const userData: any = {};
      if (data.displayName !== undefined) userData.displayName = data.displayName.trim();
      if (data.password !== undefined) {
        userData.passwordHash = await (await import('argon2')).hash(data.password);
        userData.passwordChangedAt = new Date();
      }
      await this.prisma.db.user.update({ where: { id: userId }, data: userData });
    }

    if (data.role !== undefined || data.status !== undefined) {
      await this.prisma.db.tenantMembership.update({
        where: { id: membership.id },
        data: {
          ...(data.role !== undefined ? { role: data.role } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
      });
    }

    return this.getUser(tenantId, userId);
  }

  async listUsers(tenantId: string) {
    return this.prisma.db.tenantMembership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, username: true, displayName: true, status: true, driver: { select: { id: true, code: true, name: true } } } } },
    });
  }

  async inviteUser(tenantId: string, username: string, displayName: string, role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER', invitedByUserId: string, driverId?: string) {
    const user = await this.prisma.db.user.create({
      data: {
        username,
        displayName,
        passwordHash: '',
        status: 'INVITED',
        ...(driverId ? { driver: { connect: { id: driverId } } } : {}),
      },
    });
    const membership = await this.prisma.db.tenantMembership.create({
      data: {
        tenantId,
        userId: user.id,
        role,
        status: 'INVITED',
        invitedByUserId,
      },
    });
    const rawToken = (await import('node:crypto')).randomBytes(32).toString('base64url');
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.db.accountAccessToken.create({
      data: {
        userId: user.id,
        tokenHash,
        purpose: 'INVITATION',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: invitedByUserId,
      },
    });
    if (username.includes('@')) await this.email.sendInvitation(username, rawToken);
    return { user, membership, invitationToken: rawToken };
  }

  async acceptInvitation(token: string, passwordHash: string) {
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const accessToken = await this.prisma.db.accountAccessToken.findFirst({
      where: { tokenHash, purpose: 'INVITATION', consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!accessToken) throw new Error('INVALID_OR_EXPIRED_TOKEN');
    await this.prisma.db.user.update({
      where: { id: accessToken.userId },
      data: { passwordHash, status: 'ACTIVE', passwordChangedAt: new Date() },
    });
    await this.prisma.db.tenantMembership.updateMany({
      where: { userId: accessToken.userId, status: 'INVITED' },
      data: { status: 'ACTIVE' },
    });
    await this.prisma.db.accountAccessToken.update({
      where: { id: accessToken.id },
      data: { consumedAt: new Date() },
    });
    return { ok: true };
  }

  async setTenantFeatures(tenantId: string, actorUserId: string, features: FeaturesConfig) {
    const featuresJson = features as any;
    await this.prisma.db.user.updateMany({
      where: { tenantMemberships: { some: { tenantId } } },
      data: { features: featuresJson },
    });
    await this.prisma.db.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: 'tenant.features.set',
        entityType: 'user',
        result: 'SUCCESS',
        reason: 'Fitur per tenant telah dikonfigurasi',
      },
    });
    return { success: true, features: featuresJson };
  }
}
