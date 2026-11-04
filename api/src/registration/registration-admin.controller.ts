import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PermissionGuard } from '../auth/permission.guard.js';
import { PlatformGuard } from '../auth/platform.guard.js';
import { RequirePermissions } from '../auth/permissions.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { RegistrationService } from './registration.service.js';

@Controller('admin/sppg-registrations')
@UseGuards(SessionGuard, PlatformGuard, PermissionGuard)
export class RegistrationAdminController {
  constructor(private readonly service: RegistrationService) {}

  @Get()
  @RequirePermissions('sppg:read')
  list() {
    return this.service.list();
  }

  @Post(':id/documents')
  @RequirePermissions('sppg:manage')
  addDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { objectKey: string; mimeType: string; byteSize: number; sha256: string },
  ) {
    return this.service.addDocument(
      id,
      body.objectKey,
      body.mimeType,
      body.byteSize,
      body.sha256,
      request.principal!.id,
    );
  }

  @Post(':id/documents/upload')
  @RequirePermissions('sppg:manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    return this.service.uploadDocument(id, file, request.principal!.id);
  }

  @Post(':id/provision')
  @RequirePermissions('sppg:manage')
  provision(@Param('id') id: string) {
    return this.service.provision(id);
  }

  @Patch(':id/approve')
  @RequirePermissions('sppg:manage')
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.service.approve(id, request.principal!.id, body?.notes);
  }

  @Patch(':id/reject')
  @RequirePermissions('sppg:manage')
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.service.reject(id, request.principal!.id, body?.notes);
  }

  @Patch(':id/request-revision')
  @RequirePermissions('sppg:manage')
  requestRevision(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.service.requestRevision(id, request.principal!.id, body?.notes);
  }
}
