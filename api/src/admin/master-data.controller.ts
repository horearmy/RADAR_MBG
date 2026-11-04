import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequirePermissions } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../auth/session.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  CreateAssignmentDto,
  CreateDeliveryLocationDto,
  CreateDriverDto,
  CreateOrganizationDto,
  CreateRegionDto,
  CreateSppgDto,
  CreateVehicleDto,
  EndAssignmentDto,
  ListAssignmentsDto,
  MasterDataListDto,
  UpdateDeliveryLocationDto,
  UpdateDriverDto,
  UpdateOrganizationDto,
  UpdateRegionDto,
  UpdateSppgDto,
  UpdateVehicleDto,
} from './master-data.dto.js';
import { MasterDataService } from './master-data.service.js';

@Controller('admin')
@UseGuards(SessionGuard, PermissionGuard)
export class MasterDataController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get('organizations')
  @RequirePermissions('master:read')
  listOrganizations(
    @Req() request: AuthenticatedRequest,
    @Query() query: MasterDataListDto,
  ) {
    return this.masterData.listOrganizations(request.principal!, query);
  }

  @Post('organizations')
  @RequirePermissions('master:manage')
  createOrganization(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateOrganizationDto,
  ) {
    return this.masterData.createOrganization(input, request.principal!, this.requestId(request));
  }

  @Get('regions')
  @RequirePermissions('master:read')
  listRegions(
    @Req() request: AuthenticatedRequest,
    @Query() query: MasterDataListDto,
  ) {
    return this.masterData.listRegions(request.principal!, query);
  }

  @Post('regions')
  @RequirePermissions('master:manage')
  createRegion(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateRegionDto,
  ) {
    return this.masterData.createRegion(input, request.principal!, this.requestId(request));
  }

  @Get('sppg')
  @RequirePermissions('master:read')
  listSppgs(
    @Req() request: AuthenticatedRequest,
    @Query() query: MasterDataListDto,
  ) {
    return this.masterData.listSppgs(request.principal!, query);
  }

  @Post('sppg')
  @RequirePermissions('master:manage')
  createSppg(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateSppgDto,
  ) {
    return this.masterData.createSppg(input, request.principal!, this.requestId(request));
  }

  @Get('delivery-locations')
  @RequirePermissions('master:read')
  listDeliveryLocations(
    @Req() request: AuthenticatedRequest,
    @Query() query: MasterDataListDto,
  ) {
    return this.masterData.listDeliveryLocations(request.principal!, query);
  }

  @Post('delivery-locations')
  @RequirePermissions('master:manage')
  createDeliveryLocation(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateDeliveryLocationDto,
  ) {
    return this.masterData.createDeliveryLocation(
      input,
      request.principal!,
      this.requestId(request),
    );
  }

  @Get('vehicles')
  @RequirePermissions('master:read')
  listVehicles(
    @Req() request: AuthenticatedRequest,
    @Query() query: MasterDataListDto,
  ) {
    return this.masterData.listVehicles(request.principal!, query, request.tenantContext ?? null);
  }

  @Post('vehicles')
  @RequirePermissions('master:manage')
  createVehicle(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateVehicleDto,
  ) {
    return this.masterData.createVehicle(input, request.principal!, this.requestId(request));
  }

  @Get('drivers')
  @RequirePermissions('master:read')
  listDrivers(
    @Req() request: AuthenticatedRequest,
    @Query() query: MasterDataListDto,
  ) {
    return this.masterData.listDrivers(request.principal!, query, request.tenantContext ?? null);
  }

  @Get('drivers/next-code')
  @RequirePermissions('master:read')
  nextDriverCode(
    @Req() request: AuthenticatedRequest,
    @Query('sppgId', new ParseUUIDPipe()) sppgId: string,
  ) {
    return this.masterData.nextDriverCode(sppgId, request.principal!);
  }

  @Get('assignments')
  @RequirePermissions('master:read')
  listAssignments(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListAssignmentsDto,
  ) {
    return this.masterData.listAssignments(request.principal!, query);
  }

  @Post('assignments')
  @RequirePermissions('master:manage')
  createAssignment(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateAssignmentDto,
  ) {
    return this.masterData.createAssignment(input, request.principal!, this.requestId(request));
  }

  @Patch('assignments/:id/end')
  @RequirePermissions('master:manage')
  endAssignment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: EndAssignmentDto,
  ) {
    return this.masterData.endAssignment(id, input, request.principal!, this.requestId(request));
  }

  @Patch('organizations/:id')
  @RequirePermissions('master:manage')
  updateOrganization(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateOrganizationDto,
  ) {
    return this.masterData.updateOrganization(id, input, request.principal!, this.requestId(request));
  }

  @Patch('regions/:id')
  @RequirePermissions('master:manage')
  updateRegion(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateRegionDto,
  ) {
    return this.masterData.updateRegion(id, input, request.principal!, this.requestId(request));
  }

  @Patch('sppg/:id')
  @RequirePermissions('master:manage')
  updateSppg(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSppgDto,
  ) {
    return this.masterData.updateSppg(id, input, request.principal!, this.requestId(request));
  }

  @Patch('delivery-locations/:id')
  @RequirePermissions('master:manage')
  updateDeliveryLocation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDeliveryLocationDto,
  ) {
    return this.masterData.updateDeliveryLocation(id, input, request.principal!, this.requestId(request));
  }

  @Patch('vehicles/:id')
  @RequirePermissions('master:manage')
  updateVehicle(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleDto,
  ) {
    return this.masterData.updateVehicle(id, input, request.principal!, this.requestId(request));
  }

  @Patch('drivers/:id')
  @RequirePermissions('master:manage')
  updateDriver(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDriverDto,
  ) {
    return this.masterData.updateDriver(id, input, request.principal!, this.requestId(request));
  }

  private requestId(request: AuthenticatedRequest): string {
    const candidate = request.get('x-request-id');
    return candidate && /^[A-Za-z0-9._:-]{1,100}$/.test(candidate) ? candidate : randomUUID();
  }
}
