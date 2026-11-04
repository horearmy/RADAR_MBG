import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RegistrationService } from './registration.service.js';

@Controller('public/sppg-registrations')
export class PublicRegistrationController {
  constructor(private readonly service: RegistrationService) {}

  @Post()
  create(@Body() body: any) {
    return this.service.createDraft(body);
  }

  @Get('status/:registrationNumber')
  status(@Param('registrationNumber') registrationNumber: string) {
    return this.service.getStatus(registrationNumber);
  }
}
