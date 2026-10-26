import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import { DeliveryService } from './delivery.service.js';
import { ReviewDeliveryDto, SubmitDeliveryDto } from './delivery.dto.js';
import { ProofService, type UploadedProofFile } from './proof.service.js';

@Controller('trips/:tripId')
@UseGuards(SessionGuard, PermissionGuard)
export class DeliveryController {
  constructor(
    private readonly delivery: DeliveryService,
    private readonly proofs: ProofService,
  ) {}

  @Post('delivery/start')
  @RequirePermissions('delivery:start')
  start(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.delivery.startDelivery(
      tripId,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
    );
  }

  @Post('delivery')
  @RequirePermissions('delivery:confirm')
  submit(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() input: SubmitDeliveryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.delivery.submitDelivery(
      tripId,
      request.principal!,
      input,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
    );
  }

  @Post('delivery/review')
  @RequirePermissions('delivery:review')
  review(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() input: ReviewDeliveryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.delivery.reviewDelivery(
      tripId,
      request.principal!,
      input,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
    );
  }

  @Post('delivery/proofs')
  @RequirePermissions('delivery:confirm')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  }))
  uploadProof(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @UploadedFile() file?: UploadedProofFile,
  ) {
    return this.proofs.uploadProof(
      tripId,
      request.principal!,
      file,
      this.requestId(request),
    );
  }

  @Get('delivery/proofs')
  @RequirePermissions('delivery:proof:read')
  @Header('Cache-Control', 'no-store')
  listProofs(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
  ) {
    return this.proofs.listProofs(tripId, request.principal!, this.requestId(request));
  }

  @Get('delivery/proofs/:proofId/url')
  @RequirePermissions('delivery:proof:read')
  @Header('Cache-Control', 'no-store')
  proofUrl(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('proofId', ParseUUIDPipe) proofId: string,
  ) {
    return this.proofs.getDownloadUrl(tripId, proofId, request.principal!, this.requestId(request));
  }

  @Post('complete')
  @RequirePermissions('trip:complete')
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.delivery.completeTrip(
      tripId,
      request.principal!,
      this.requireIdempotencyKey(idempotencyKey),
      this.requestId(request),
    );
  }

  private requireIdempotencyKey(value?: string) {
    if (!value) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    return value;
  }

  private requestId(request: AuthenticatedRequest) {
    const candidate = request.get('x-request-id');
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}
