import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { CreateRecipientRegistrationCodeDto, CreateRecipientRegistrationRequestDto, ReviewRecipientRegistrationRequestDto } from './recipient-registration.dto.js';

@Injectable()
export class RecipientRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async createRegistrationCode(tenantId: string, createdBy: string) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id: tenantId }, select: { tenantCode: true } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });

    const base = tenant.tenantCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase() || 'TENANT';
    let code = `REG-${base}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    for (let i = 0; i < 5; i += 1) {
      const existing = await this.prisma.db.recipientRegistrationCode.findUnique({ where: { code } });
      if (!existing) break;
      code = `REG-${base}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }

    return this.prisma.db.recipientRegistrationCode.create({
      data: { tenantId, code, createdBy, active: true },
    });
  }

  async listRegistrationCodes(tenantId: string | null) {
    if (!tenantId) return [];
    return this.prisma.db.recipientRegistrationCode.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, active: true, createdAt: true, updatedAt: true },
    });
  }

  async validateCode(code: string) {
    const row = await this.prisma.db.recipientRegistrationCode.findUnique({
      where: { code },
      include: { tenant: { select: { id: true, tenantCode: true, name: true, status: true } } },
    });
    if (!row || !row.active || row.tenant.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'REGISTRATION_CODE_INVALID' });
    }
    return { code: row.code, tenant: row.tenant };
  }

  async createRequest(input: CreateRecipientRegistrationRequestDto) {
    const code = await this.validateCode(input.code);
    return this.prisma.db.recipientRegistrationRequest.create({
      data: {
        registrationCodeId: (await this.prisma.db.recipientRegistrationCode.findUnique({ where: { code: input.code }, select: { id: true } }))?.id ?? null,
        tenantId: code.tenant.id,
        requesterName: input.requesterName.trim(),
        contactPhone: input.contactPhone?.trim() ?? null,
        contactEmail: input.contactEmail?.trim().toLowerCase() ?? null,
        requestedSiteName: input.requestedSiteName?.trim() ?? null,
        notes: input.notes?.trim() ?? null,
        status: 'PENDING_REVIEW',
      },
    });
  }

  async listRecipientSites(tenantId?: string | null) {
    if (!tenantId) return [];
    const locations = await this.prisma.db.deliveryLocation.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const locationIds = locations.map((location) => location.id);
    if (locationIds.length === 0) return [];
    return this.prisma.db.recipientSite.findMany({
      where: { active: true, deliveryLocationId: { in: locationIds } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });
  }

  async listRequests(principal: SessionPrincipal, tenantId?: string | null) {
    const where: any = {};
    if (principal.roles.some((role) => role.isGlobal)) {
      if (tenantId) where.tenantId = tenantId;
    } else if (tenantId) {
      where.tenantId = tenantId;
    } else {
      return [];
    }
    return this.prisma.db.recipientRegistrationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        tenant: { select: { id: true, tenantCode: true, name: true } },
        approvedSite: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async reviewRequest(id: string, input: ReviewRecipientRegistrationRequestDto, principal: SessionPrincipal, tenantId?: string | null) {
    const request = await this.prisma.db.recipientRegistrationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException({ code: 'RECIPIENT_REGISTRATION_NOT_FOUND' });

    const isGlobal = principal.roles.some((role) => role.isGlobal);
    if (!isGlobal && tenantId && request.tenantId !== tenantId) {
      throw new NotFoundException({ code: 'RECIPIENT_REGISTRATION_NOT_FOUND' });
    }

    if (input.decision === 'APPROVE') {
      if (!input.recipientSiteId) throw new BadRequestException({ code: 'RECIPIENT_SITE_REQUIRED' });
      const site = await this.prisma.db.recipientSite.findUnique({
        where: { id: input.recipientSiteId },
        include: { organization: true },
      });
      if (!site || !site.active) throw new NotFoundException({ code: 'RECIPIENT_SITE_NOT_FOUND' });

      // Scope check: tenant admin can only approve sites linked to its delivery location.
      if (!isGlobal && tenantId) {
        const location = site.deliveryLocationId
          ? await this.prisma.db.deliveryLocation.findUnique({ where: { id: site.deliveryLocationId }, select: { tenantId: true } })
          : null;
        if (!location || location.tenantId !== tenantId) {
          throw new NotFoundException({ code: 'RECIPIENT_SITE_NOT_FOUND' });
        }
      }

      const username = request.contactEmail || `recipient-${request.id.slice(0, 8)}`;
      let user = await this.prisma.db.user.findUnique({ where: { username } });
      if (!user) {
        user = await this.prisma.db.user.create({
          data: {
            username,
            displayName: request.requesterName,
            email: request.contactEmail ?? null,
            passwordHash: '',
            status: 'INVITED',
          },
        });
      }

      await this.prisma.db.recipientMembership.upsert({
        where: { userId_recipientSiteId: { userId: user.id, recipientSiteId: site.id } },
        update: { status: 'INVITED' },
        create: { userId: user.id, recipientSiteId: site.id, status: 'INVITED' },
      });

      const { createHash, randomBytes } = await import('node:crypto');
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      await this.prisma.db.accountAccessToken.create({
        data: {
          userId: user.id,
          tokenHash,
          purpose: 'INVITATION',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdBy: principal.id,
        },
      });

      await this.prisma.db.recipientRegistrationRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedByUserId: principal.id,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes ?? null,
          approvedRecipientSiteId: site.id,
        },
      });

      return { status: 'APPROVED', invitationToken: rawToken, adminUsername: user.username };
    }

    if (input.decision === 'REJECT') {
      await this.prisma.db.recipientRegistrationRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: principal.id,
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes ?? null,
        },
      });
      return { status: 'REJECTED' };
    }

    await this.prisma.db.recipientRegistrationRequest.update({
      where: { id },
      data: {
        status: 'REVISION_REQUIRED',
        reviewedByUserId: principal.id,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes ?? null,
      },
    });
    return { status: 'REVISION_REQUIRED' };
  }
}