import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { PrivateStorageService } from '../storage/storage.service.js';

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService, private readonly storage: PrivateStorageService) {}

  async createDraft(input: any) {
    const regNumber = `REG-${Date.now()}`;
    return this.prisma.db.tenantRegistration.create({
      data: {
        registrationNumber: regNumber,
        sppgName: input.sppgName || 'Draft',
        provinceCode: input.provinceCode || '00',
        regencyCode: input.regencyCode || '00',
        districtCode: input.districtCode || '00',
        villageCode: input.villageCode || '00',
        fullAddress: input.fullAddress || '',
        contactName: input.contactName || '',
        contactEmail: input.contactEmail || '',
        contactPhone: input.contactPhone || '',
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  async approve(id: string, approverId: string, notes?: string) {
    return this.prisma.db.tenantRegistration.update({
      where: { id },
      data: { status: 'APPROVED', reviewedByUserId: approverId, reviewedAt: new Date(), reviewNotes: notes },
    });
  }

  async reject(id: string, approverId: string, notes?: string) {
    return this.prisma.db.tenantRegistration.update({
      where: { id },
      data: { status: 'REJECTED', reviewedByUserId: approverId, reviewedAt: new Date(), reviewNotes: notes },
    });
  }

  async requestRevision(id: string, approverId: string, notes?: string) {
    return this.prisma.db.tenantRegistration.update({
      where: { id },
      data: { status: 'REVISION_REQUIRED', reviewedByUserId: approverId, reviewedAt: new Date(), reviewNotes: notes },
    });
  }

  async uploadDocument(registrationId: string, file: { buffer: Buffer; originalname: string; mimetype: string }, uploadedBy?: string) {
    const { createHash } = await import('node:crypto');
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const key = `registrations/${registrationId}/${Date.now()}-${file.originalname}`;
    await this.storage.putObject({ key, body: file.buffer, contentType: file.mimetype, sha256, uploadedBy: uploadedBy ?? 'anonymous' });
    return this.addDocument(registrationId, key, file.mimetype, file.buffer.length, sha256, uploadedBy);
  }

  async addDocument(registrationId: string, objectKey: string, mimeType: string, byteSize: number, sha256: string, uploadedBy?: string) {
    return this.prisma.db.registrationDocument.create({
      data: { registrationId, objectKey, mimeType, byteSize: BigInt(byteSize), sha256, uploadedBy: uploadedBy ?? null },
    });
  }

  async provision(id: string) {
    try {
      const reg = await this.prisma.db.tenantRegistration.findUnique({ where: { id } });
      if (!reg) throw new NotFoundException({ code: 'REGISTRATION_NOT_FOUND' });
      if (reg.status !== 'APPROVED') throw new BadRequestException({ code: 'REGISTRATION_NOT_APPROVED' });
      if (reg.tenantId) {
        const tenant = await this.prisma.db.tenant.findUnique({ where: { id: reg.tenantId } });
        return { tenant, alreadyProvisioned: true };
      }

      const tenantCode = `SPPG-${reg.registrationNumber}`;
      let tenant = await this.prisma.db.tenant.findUnique({ where: { tenantCode } });
      if (!tenant) {
        tenant = await this.prisma.db.tenant.create({
          data: { tenantCode, name: reg.sppgName, status: 'ACTIVE' },
        });
      }
    await this.prisma.db.sppgProfile.upsert({
      where: { tenantId: tenant.id },
      update: { sppgName: reg.sppgName },
      create: {
        tenantId: tenant.id,
        sppgName: reg.sppgName,
        officialCode: reg.officialCode,
        fullAddress: reg.fullAddress,
        latitude: reg.latitude,
        longitude: reg.longitude,
        contactPhone: reg.contactPhone,
      },
    });

    const username = reg.contactEmail || `admin-${reg.registrationNumber}`;
    let user = await this.prisma.db.user.findUnique({ where: { username } });
    if (!user) {
      user = await this.prisma.db.user.create({
        data: { username, displayName: reg.contactName || 'Admin SPPG', passwordHash: '', status: 'INVITED' },
      });
    }
    const membership = await this.prisma.db.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: { role: 'TENANT_ADMIN', status: 'INVITED' },
      create: { tenantId: tenant.id, userId: user.id, role: 'TENANT_ADMIN', status: 'INVITED' },
    });

    const { createHash, randomBytes } = await import('node:crypto');
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.db.accountAccessToken.create({
      data: { userId: user.id, tokenHash, purpose: 'INVITATION', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdBy: user.id },
    });

    await this.prisma.db.tenantRegistration.update({ where: { id }, data: { tenantId: tenant.id } });

    return { tenant, membership, invitationToken: rawToken, alreadyProvisioned: false };
    } catch (e: any) {
      throw new BadRequestException({ code: 'PROVISION_FAILED', message: e?.message ?? 'Provision failed' });
    }
  }

  async getStatus(registrationNumber: string) {
    return this.prisma.db.tenantRegistration.findUnique({
      where: { registrationNumber },
      select: { registrationNumber: true, status: true, reviewNotes: true, submittedAt: true, reviewedAt: true },
    });
  }

  async list() {
    return this.prisma.db.tenantRegistration.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
