import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { PrivateStorageService } from '../storage/storage.service.js';

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export type UploadedProofFile = {
  buffer: Buffer;
  originalname: string;
};

@Injectable()
export class ProofService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateStorageService,
  ) {}

  async uploadProof(
    tripId: string,
    principal: SessionPrincipal,
    file: UploadedProofFile | undefined,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'PROOF_FILE_REQUIRED' });
    }
    if (file.buffer.length > MAX_PROOF_BYTES) {
      throw new BadRequestException({ code: 'PROOF_FILE_TOO_LARGE' });
    }

    const detected = detectMimeType(file.buffer);
    if (!detected || !ALLOWED_TYPES.has(detected.mimeType)) {
      throw new BadRequestException({ code: 'PROOF_FILE_TYPE_UNSUPPORTED' });
    }

    const trip = await this.findScopedTrip(tripId, principal, tenantContext);
    const record = await this.prisma.db.deliveryRecord.findFirst({
      where: { tripId, isCurrent: true },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (!record) throw new ConflictException({ code: 'DELIVERY_RECORD_REQUIRED' });
    if (trip.status === 'CANCELLED') {
      throw new ConflictException({ code: 'TRIP_CANCELLED' });
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.db.proofOfDelivery.findUnique({
      where: {
        deliveryRecordId_sha256: { deliveryRecordId: record.id, sha256 },
      },
    });
    if (existing) return this.present(existing, true, true);

    const objectKey =
      `pod/${trip.organizationId}/${tripId}/${record.id}/${randomUUID()}.${detected.extension}`;
    await this.storage.putObject({
      key: objectKey,
      body: file.buffer,
      contentType: detected.mimeType,
      sha256,
      uploadedBy: principal.id,
    });

    try {
      const proof = await this.prisma.db.$transaction(async (tx) => {
        const created = await tx.proofOfDelivery.create({
          data: {
            deliveryRecordId: record.id,
            objectKey,
            mimeType: detected.mimeType,
            originalName: cleanFileName(file.originalname),
            byteSize: BigInt(file.buffer.length),
            sha256,
            uploadedBy: principal.id,
          },
        });

        await tx.tripEvent.create({
          data: {
            tripId,
            actorUserId: principal.id,
            eventType: 'POD.PROOF_ADDED',
            metadata: {
              proofId: created.id,
              deliveryRecordId: record.id,
              mimeType: created.mimeType,
              byteSize: Number(created.byteSize),
              sha256,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: principal.id,
            action: 'delivery.proof.upload',
            entityType: 'trip',
            entityId: tripId,
            result: 'success',
            reason: 'POD evidence uploaded',
            after: {
              proofId: created.id,
              deliveryRecordId: record.id,
              mimeType: created.mimeType,
              byteSize: Number(created.byteSize),
              sha256,
            },
            requestId,
          },
        });
        return created;
      });
      return this.present(proof, false, true);
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.db.proofOfDelivery.findUnique({
          where: {
            deliveryRecordId_sha256: { deliveryRecordId: record.id, sha256 },
          },
        });
        if (duplicate) return this.present(duplicate, true, true);
      }
      throw error;
    }
  }

  async listProofs(tripId: string, principal: SessionPrincipal, requestId: string, tenantContext?: { tenantId: string } | null) {
    await this.findScopedTrip(tripId, principal, tenantContext);
    const proofs = await this.prisma.db.proofOfDelivery.findMany({
      where: { deliveryRecord: { tripId } },
      orderBy: { uploadedAt: 'desc' },
    });
    await this.writeAccessAudit(principal, tripId, 'delivery.proof.list', proofs.length, requestId);
    return Promise.all(
      proofs.map((proof) => this.present(proof, false, this.storage.configured)),
    );
  }

  async getDownloadUrl(
    tripId: string,
    proofId: string,
    principal: SessionPrincipal,
    requestId: string,
    tenantContext?: { tenantId: string } | null,
  ) {
    await this.findScopedTrip(tripId, principal, tenantContext);
    const proof = await this.prisma.db.proofOfDelivery.findFirst({
      where: { id: proofId, deliveryRecord: { tripId } },
    });
    if (!proof) throw new NotFoundException({ code: 'PROOF_NOT_FOUND' });
    const url = await this.storage.signedDownloadUrl(proof.objectKey, 300);
    await this.writeAccessAudit(principal, tripId, 'delivery.proof.download_url', 1, requestId, proof.id);

    return {
      proofId: proof.id,
      url,
      expiresInSeconds: 300,
    };
  }

  private async writeAccessAudit(
    principal: SessionPrincipal,
    tripId: string,
    action: string,
    proofCount: number,
    requestId: string,
    proofId?: string,
  ) {
    await this.prisma.db.auditLog.create({
      data: {
        actorUserId: principal.id,
        action,
        entityType: 'trip',
        entityId: tripId,
        result: 'success',
        reason: 'Authorized POD evidence access',
        after: {
          proofCount,
          ...(proofId ? { proofId } : {}),
        },
        requestId,
      },
    });
  }

  private async findScopedTrip(tripId: string, principal: SessionPrincipal, tenantContext?: { tenantId: string } | null) {
    const trip = await this.prisma.db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        tenantId: true,
        organizationId: true,
        sppgId: true,
        deliveryLocationId: true,
        driverId: true,
        status: true,
      },
    });
    if (!trip) throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    if (trip.tenantId !== (tenantContext?.tenantId ?? null)) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }

    const [source, destination] = await Promise.all([
      this.prisma.db.sppg.findUnique({
        where: { id: trip.sppgId },
        select: { id: true, regionId: true },
      }),
      this.prisma.db.deliveryLocation.findUnique({
        where: { id: trip.deliveryLocationId },
        select: { regionId: true },
      }),
    ]);
    if (!source || !destination) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }

    const inScope = principal.roles.some(
      (role) =>
        role.isGlobal ||
        role.organizationId === trip.organizationId ||
        role.regionId === source.regionId ||
        role.regionId === destination.regionId ||
        role.sppgId === source.id,
    );
    const requiresDriverScope =
      principal.driverId !== null ||
      principal.roles.some((role) => role.code === 'DRIVER');
    if (
      !inScope ||
      (requiresDriverScope &&
        !principal.roles.some((role) => role.isGlobal) &&
        (!principal.driverId || principal.driverId !== trip.driverId))
    ) {
      throw new NotFoundException({ code: 'TRIP_NOT_FOUND' });
    }
    return trip;
  }

  private async present(
    proof: {
      id: string;
      deliveryRecordId: string;
      objectKey: string;
      mimeType: string;
      originalName: string | null;
      byteSize: bigint;
      sha256: string;
      uploadedBy: string;
      uploadedAt: Date;
    },
    deduplicated: boolean,
    includeUrl: boolean,
  ) {
    return {
      id: proof.id,
      deliveryRecordId: proof.deliveryRecordId,
      mimeType: proof.mimeType,
      originalName: proof.originalName,
      byteSize: Number(proof.byteSize),
      sha256: proof.sha256,
      uploadedBy: proof.uploadedBy,
      uploadedAt: proof.uploadedAt,
      deduplicated,
      url: includeUrl
        ? await this.storage.signedDownloadUrl(proof.objectKey, 300)
        : null,
    };
  }
}

function cleanFileName(value: string) {
  let name = '';
  for (const character of basename(value)) {
    const code = character.charCodeAt(0);
    if (code >= 32 && code !== 127) name += character;
  }
  return (name.trim() || 'proof').slice(0, 255);
}

function detectMimeType(buffer: Buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  ) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  return null;
}
