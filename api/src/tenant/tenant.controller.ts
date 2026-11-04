import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { RequireTenant, TenantGuard } from '../auth/tenant.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { Req } from '@nestjs/common';
import { TenantService } from './tenant.service.js';

@Controller('tenant')
@RequireTenant()
@UseGuards(SessionGuard, TenantGuard, PermissionGuard)
export class TenantController {
  constructor(private readonly service: TenantService) {}

  @Get('summary')
  @RequirePermissions('tenant:read')
  summary(@Req() req: AuthenticatedRequest) {
    return this.service.summary(req.tenantContext!.tenantId);
  }

  @Get('me')
  @RequirePermissions('tenant:read')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.service.getMe(req.tenantContext!.tenantId);
  }

  @Patch('profile')
  @RequirePermissions('sppg:manage')
  updateProfile(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.updateProfile(req.tenantContext!.tenantId, req.principal!.id, body as never);
  }

  @Post('delivery-locations')
  @RequirePermissions('master:manage')
  createDeliveryLocation(@Req() req: AuthenticatedRequest, @Body() body: { code: string; name: string; address?: string; latitude?: number; longitude?: number }) {
    return this.service.createDeliveryLocation(req.tenantContext!.tenantId, body);
  }

  @Get('delivery-locations/:id')
  @RequirePermissions('master:read')
  getDeliveryLocation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getDeliveryLocation(req.tenantContext!.tenantId, id);
  }

  @Patch('delivery-locations/:id')
  @RequirePermissions('master:manage')
  updateDeliveryLocation(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { name?: string; address?: string; latitude?: number; longitude?: number; active?: boolean }) {
    return this.service.updateDeliveryLocation(req.tenantContext!.tenantId, id, body);
  }

  @Get('delivery-locations')
  @RequirePermissions('master:read')
  deliveryLocations(@Req() req: AuthenticatedRequest) {
    return this.service.listDeliveryLocations(req.tenantContext!.tenantId);
  }

  @Post('trips')
  @RequirePermissions('trip:create')
  createTrip(@Req() req: AuthenticatedRequest, @Body() body: { deliveryLocationId: string; vehicleId: string; driverId: string; plannedDepartureAt: string; plannedArrivalAt: string; plannedQuantity: number }) {
    return this.service.createTrip(req.tenantContext!.tenantId, req.principal!, body);
  }

  @Get('drivers')
  @RequirePermissions('master:read')
  drivers(@Req() req: AuthenticatedRequest) {
    return this.service.listDrivers(req.tenantContext!.tenantId);
  }

  @Post('drivers')
  @RequirePermissions('master:manage')
  createDriver(@Req() req: AuthenticatedRequest, @Body() body: { code: string; name: string; phone?: string }) {
    return this.service.createDriver(req.tenantContext!.tenantId, body);
  }

  @Get('vehicles')
  @RequirePermissions('master:read')
  vehicles(@Req() req: AuthenticatedRequest) {
    return this.service.listVehicles(req.tenantContext!.tenantId);
  }

  @Post('vehicles')
  @RequirePermissions('master:manage')
  createVehicle(@Req() req: AuthenticatedRequest, @Body() body: { plateNumber: string; label?: string; capacity?: number }) {
    return this.service.createVehicle(req.tenantContext!.tenantId, body);
  }

  @Get('trips')
  @RequirePermissions('trip:read')
  trips(@Req() req: AuthenticatedRequest) {
    return this.service.listTrips(req.tenantContext!.tenantId);
  }

  @Get('audit')
  @RequirePermissions('tenant:read')
  audit(@Req() req: AuthenticatedRequest) {
    return this.service.listAudit(req.tenantContext!.tenantId);
  }

  @Post('users/bulk-role')
  @RequirePermissions('tenant:manage')
  bulkRole(@Req() req: AuthenticatedRequest, @Body() body: { userIds: string[]; role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER' }) {
    return this.service.bulkAssignRole(req.tenantContext!.tenantId, body.userIds, body.role);
  }

  @Post('users/bulk-status')
  @RequirePermissions('tenant:manage')
  bulkStatus(@Req() req: AuthenticatedRequest, @Body() body: { userIds: string[]; status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' }) {
    return this.service.bulkUpdateStatus(req.tenantContext!.tenantId, body.userIds, body.status);
  }

  @Get('users')
  @RequirePermissions('tenant:read')
  listUsers(@Req() req: AuthenticatedRequest) {
    return this.service.listUsers(req.tenantContext!.tenantId);
  }

  @Get('users/:id')
  @RequirePermissions('tenant:read')
  getUser(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.getUser(req.tenantContext!.tenantId, id);
  }

  @Patch('users/:id')
  @RequirePermissions('tenant:manage')
  updateUser(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { displayName?: string; role?: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER'; status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'; password?: string }) {
    return this.service.updateUser(req.tenantContext!.tenantId, id, body, req.principal!.id);
  }

  @Post('users')
  @RequirePermissions('tenant:manage')
  createUser(@Req() req: AuthenticatedRequest, @Body() body: { username: string; displayName: string; password: string; role?: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER'; driverId?: string }) {
    return this.service.createUser(req.tenantContext!.tenantId, body.username, body.displayName, body.password, body.role ?? 'TENANT_DRIVER', body.driverId, req.principal!.id);
  }

  @Post('invitations')
  @RequirePermissions('tenant:manage')
  invite(@Req() req: AuthenticatedRequest, @Body() body: { username: string; displayName: string; role: 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_DRIVER' | 'TENANT_VIEWER'; driverId?: string }) {
    return this.service.inviteUser(req.tenantContext!.tenantId, body.username, body.displayName, body.role, req.principal!.id, body.driverId);
  }

  @Post('invitations/accept')
  @RequirePermissions('account:invitation:accept')
  accept(@Body() body: { token: string; passwordHash: string }) {
    return this.service.acceptInvitation(body.token, body.passwordHash);
  }
}
