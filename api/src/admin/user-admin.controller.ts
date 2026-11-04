import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  AssignUserRoleDto,
  CreateUserInvitationDto,
  ListUsersDto,
  RevokeUserRoleDto,
  RevokeUserSessionsDto,
  UpdateUserStatusDto,
} from './user-admin.dto.js';
import { UserAdminService } from './user-admin.service.js';

@Controller('admin')
@UseGuards(SessionGuard, PermissionGuard)
export class UserAdminController {
  constructor(private readonly users: UserAdminService) {}

  @Get('users')
  @RequirePermissions('admin:manage_users')
  listUsers(@Req() request: AuthenticatedRequest, @Query() query: ListUsersDto) {
    return this.users.listUsers(request.principal!, query);
  }

  @Get('roles')
  @RequirePermissions('admin:manage_roles')
  listRoles() {
    return this.users.listRoles();
  }

  @Post('users/invitations')
  @RequirePermissions('admin:manage_users')
  createInvitation(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() input: CreateUserInvitationDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.users.createInvitation(request.principal!, input, this.safeRequestId(requestId));
  }

  @Post('users/:id/password-reset')
  @RequirePermissions('admin:manage_users')
  createPasswordReset(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: RevokeUserSessionsDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.users.createPasswordReset(
      request.principal!,
      userId,
      input.reason,
      this.safeRequestId(requestId),
    );
  }

  @Post('users/:id/mfa-reset')
  @RequirePermissions('admin:manage_users')
  resetUserMfa(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: RevokeUserSessionsDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.users.resetUserMfa(
      request.principal!,
      userId,
      input.reason,
      this.safeRequestId(requestId),
    );
  }

  @Post('users/:id/invitation-resend')
  @RequirePermissions('admin:manage_users')
  resendInvitation(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: RevokeUserSessionsDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.users.resendInvitation(
      request.principal!,
      userId,
      input.reason,
      this.safeRequestId(requestId),
    );
  }

  @Patch('users/:id/status')
  @RequirePermissions('admin:manage_users')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: UpdateUserStatusDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.users.updateStatus(request.principal!, userId, input, this.safeRequestId(requestId));
  }

  @Post('users/:id/revoke-sessions')
  @RequirePermissions('admin:manage_users')
  revokeSessions(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: RevokeUserSessionsDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.users.revokeSessions(
      request.principal!,
      userId,
      input.reason,
      this.safeRequestId(requestId),
    );
  }

  @Post('users/:id/roles')
  @RequirePermissions('admin:manage_roles')
  assignRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: AssignUserRoleDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.users.assignRole(request.principal!, userId, input, this.safeRequestId(requestId));
  }

  @Patch('users/:id/roles/revoke')
  @RequirePermissions('admin:manage_roles')
  revokeRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: RevokeUserRoleDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.users.revokeRole(request.principal!, userId, input, this.safeRequestId(requestId));
  }

  private safeRequestId(candidate?: string) {
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate)
      ? candidate
      : randomUUID();
  }
}
