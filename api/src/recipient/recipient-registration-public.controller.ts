import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RecipientRegistrationService } from './recipient-registration.service.js';
import { CreateRecipientRegistrationRequestDto } from './recipient-registration.dto.js';

@Controller('public/recipient-registrations')
export class RecipientRegistrationPublicController {
  constructor(private readonly service: RecipientRegistrationService) {}

  @Get('codes/:code')
  validateCode(@Param('code') code: string) {
    return this.service.validateCode(code);
  }

  @Post()
  create(@Body() input: CreateRecipientRegistrationRequestDto) {
    return this.service.createRequest(input);
  }
}