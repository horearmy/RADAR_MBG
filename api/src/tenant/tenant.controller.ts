import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { TenantGuard } from '../auth/tenant.guard.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { Req } from '@nestjs/common';
import { TenantService } from './tenant.service.js';

@Controller('tenant')
@UseGuards(SessionGuard, TenantGuard)
export class TenantController {
  constructor(private readonly service: TenantService) {}

  @Get('summary')
  summary(@Req() req: AuthenticatedRequest) {
    return this.service.summary(req.tenantContext!.tenantId);
  }

  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.service.getMe(req.tenantContext!.tenantId);
  }

  @Patch('profile')
  updateProfile(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.updateProfile(req.tenantContext!.tenantId, req.principal!.id, body as never);
  }

  @Get('drivers')
  drivers(@Req() req: AuthenticatedRequest) {
    return this.service.listDrivers(req.tenantContext!.tenantId);
  }

  @Post('drivers')
  createDriver(@Req() req: AuthenticatedRequest, @Body() body: { code: string; name: string; phone?: string }) {
    return this.service.createDriver(req.tenantContext!.tenantId, body);
  }

  @Get('vehicles')
  vehicles(@Req() req: AuthenticatedRequest) {
    return this.service.listVehicles(req.tenantContext!.tenantId);
  }

  @Post('vehicles')
  createVehicle(@Req() req: AuthenticatedRequest, @Body() body: { plateNumber: string; label?: string; capacity?: number }) {
    return this.service.createVehicle(req.tenantContext!.tenantId, body);
  }

  @Get('trips')
  trips(@Req() req: AuthenticatedRequest) {
    return this.service.listTrips(req.tenantContext!.tenantId);
  }

  @Get('audit')
  audit(@Req() req: AuthenticatedRequest) {
    return this.service.listAudit(req.tenantContext!.tenantId);
  }

  @Post('users/bulk-role')
  bulkRole(@Req() req: AuthenticatedRequest, @Body() body: { userIds: string[]; role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER' }) {
    return this.service.bulkAssignRole(req.tenantContext!.tenantId, body.userIds, body.role);
  }

  @Post('users/bulk-status')
  bulkStatus(@Req() req: AuthenticatedRequest, @Body() body: { userIds: string[]; status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' }) {
    return this.service.bulkUpdateStatus(req.tenantContext!.tenantId, body.userIds, body.status);
  }

  @Get('users')
  listUsers(@Req() req: AuthenticatedRequest) {
    return this.service.listUsers(req.tenantContext!.tenantId);
  }

  @Post('invitations')
  invite(@Req() req: AuthenticatedRequest, @Body() body: { username: string; displayName: string; role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER' }) {
    return this.service.inviteUser(req.tenantContext!.tenantId, body.username, body.displayName, body.role, req.principal!.id);
  }

  @Post('invitations/accept')
  accept(@Body() body: { token: string; passwordHash: string }) {
    return this.service.acceptInvitation(body.token, body.passwordHash);
  }
}
