import { Body, Controller, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RegistrationService } from './registration.service.js';

@Controller('public/sppg-registrations')
export class RegistrationController {
  constructor(private readonly service: RegistrationService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.createDraft(body);
  }

  @Post(':id/documents')
  addDocument(@Param('id') id: string, @Body() body: { objectKey: string; mimeType: string; byteSize: number; sha256: string; uploadedBy?: string }) {
    return this.service.addDocument(id, body.objectKey, body.mimeType, body.byteSize, body.sha256, body.uploadedBy);
  }

  @Post(':id/documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(@Param('id') id: string, @UploadedFile() file: any) {
    return this.service.uploadDocument(id, file);
  }

  @Post(':id/provision')
  provision(@Param('id') id: string) {
    return this.service.provision(id);
  }

  @Get('status/:registrationNumber')
  status(@Param('registrationNumber') registrationNumber: string) {
    return this.service.getStatus(registrationNumber);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() body: { approverId: string; notes?: string }) {
    return this.service.approve(id, body.approverId, body.notes);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: { approverId: string; notes?: string }) {
    return this.service.reject(id, body.approverId, body.notes);
  }

  @Patch(':id/request-revision')
  requestRevision(@Param('id') id: string, @Body() body: { approverId: string; notes?: string }) {
    return this.service.requestRevision(id, body.approverId, body.notes);
  }
}
