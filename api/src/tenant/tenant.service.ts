import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { EmailService } from './email.service.js';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  async summary(tenantId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [drivers, vehicles, tripsToday, tripsActive, tripsDone] = await Promise.all([
      this.prisma.db.driver.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.db.vehicle.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.db.trip.count({ where: { tenantId, plannedDepartureAt: { gte: start, lt: end } } }),
      this.prisma.db.trip.count({ where: { tenantId, status: { in: ['IN_TRANSIT', 'DELIVERY_IN_PROGRESS', 'ARRIVAL_DETECTED', 'ARRIVAL_VERIFIED'] } } }),
      this.prisma.db.trip.count({ where: { tenantId, status: { in: ['DELIVERED', 'COMPLETED'] } } }),
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

  async listTrips(tenantId: string) {
    return this.prisma.db.trip.findMany({
      where: { tenantId },
      orderBy: { plannedDepartureAt: 'desc' },
      take: 50,
      select: {
        id: true, status: true, plannedDepartureAt: true, plannedQuantity: true,
        driver: { select: { name: true } },
        vehicle: { select: { plateNumber: true } },
        deliveryLocation: { select: { name: true } },
      },
    });
  }

  async listUsers(tenantId: string) {
    return this.prisma.db.tenantMembership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, username: true, displayName: true, status: true } } },
    });
  }

  async inviteUser(tenantId: string, username: string, displayName: string, role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER', invitedByUserId: string) {
    const user = await this.prisma.db.user.create({
      data: {
        username,
        displayName,
        passwordHash: '',
        status: 'INVITED',
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
}
