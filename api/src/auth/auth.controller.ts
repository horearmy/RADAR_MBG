import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import {
  BeginMfaRecoveryDto,
  BeginMfaRotationDto,
  ConfirmMfaEnrollmentDto,
  ConfirmMfaRecoveryDto,
  ConfirmMfaRotationDto,
  ConsumeAccountTokenDto,
  LoginDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import type { AuthenticatedRequest } from './session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('csrf')
  getCsrfToken(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.issueCsrfCookie(response);
  }

  @Post('login')
  login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() input: LoginDto,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.login(request, response, input);
  }

  @Post('logout')
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.logout(request, response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return { user: request.principal };
  }

  @Post('mfa/enrollment')
  @UseGuards(SessionGuard)
  beginMfaEnrollment(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.beginMfaEnrollment(request.principal!);
  }

  @Post('mfa/enrollment/confirm')
  @UseGuards(SessionGuard)
  confirmMfaEnrollment(
    @Req() request: AuthenticatedRequest,
    @Body() input: ConfirmMfaEnrollmentDto,
  ) {
    return this.authService.confirmMfaEnrollment(request.principal!, input);
  }

  @Post('mfa/rotation')
  @UseGuards(SessionGuard)
  beginMfaRotation(
    @Req() request: AuthenticatedRequest,
    @Body() input: BeginMfaRotationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.beginMfaRotation(request.principal!, input);
  }

  @Post('mfa/rotation/confirm')
  @UseGuards(SessionGuard)
  confirmMfaRotation(
    @Req() request: AuthenticatedRequest,
    @Body() input: ConfirmMfaRotationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.confirmMfaRotation(request.principal!, input.otpCode);
  }

  @Post('mfa/recovery')
  beginMfaRecovery(
    @Req() request: Request,
    @Body() input: BeginMfaRecoveryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.beginMfaRecovery(input, request);
  }

  @Post('mfa/recovery/confirm')
  confirmMfaRecovery(
    @Req() request: Request,
    @Body() input: ConfirmMfaRecoveryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.confirmMfaRecovery(input, randomUUID(), request);
  }

  @Post('account-access/consume')
  consumeAccountToken(
    @Req() request: Request,
    @Body() input: ConsumeAccountTokenDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.authService.consumeAccountToken(
      request,
      input,
      randomUUID(),
    );
  }
}
