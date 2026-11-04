import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverStatus,
  Prisma,
  SppgStatus,
  VehicleStatus,
} from '@prisma/client';
import type { SessionPrincipal } from '../auth/auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
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
import { isValidRange } from './assignment-policy.js';

type Scope = {
  global: boolean;
  organizationIds: string[];
  directOrganizationIds: string[];
  regionIds: string[];
  sppgIds: string[];
  sppgRegionIds: string[];
};

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizations(principal: SessionPrincipal, query: MasterDataListDto) {
    const scope = await this.resolveScope(principal);
    const where: Prisma.OrganizationWhereInput = scope.global
      ? {}
      : { id: { in: scope.organizationIds } };
    const [data, total] = await Promise.all([
      this.prisma.db.organization.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.organization.count({ where }),
    ]);
    return this.page(data, total, query);
  }

  async listRegions(principal: SessionPrincipal, query: MasterDataListDto) {
    const scope = await this.resolveScope(principal);
    const where: Prisma.RegionWhereInput = {
      ...(scope.global ? {} : {
        OR: [
          ...(scope.directOrganizationIds.length ? [{ organizationId: { in: scope.directOrganizationIds } }] : []),
          { id: { in: scope.regionIds } },
          { id: { in: scope.sppgRegionIds } },
        ],
      }),
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.region.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.region.count({ where }),
    ]);
    return this.page(data, total, query);
  }

  async listSppgs(principal: SessionPrincipal, query: MasterDataListDto) {
    const scope = await this.resolveScope(principal);
    const where: Prisma.SppgWhereInput = {
      ...(scope.global
        ? {}
        : principal.tenantRole && scope.sppgIds.length
          // Pengguna tenant hanya boleh melihat SPPG miliknya sendiri (legacySppgId),
          // bukan seluruh SPPG yang kebetulan berada di organisasi/region yang sama.
          ? { id: { in: scope.sppgIds } }
          : {
              OR: [
                { organizationId: { in: scope.directOrganizationIds } },
                { regionId: { in: scope.regionIds } },
                { id: { in: scope.sppgIds } },
              ],
            }),
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.regionId ? { regionId: query.regionId } : {}),
      ...(query.sppgId ? { id: query.sppgId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.sppg.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          organizationId: true,
          regionId: true,
          code: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.db.sppg.count({ where }),
    ]);
    return this.page(data, total, query);
  }

  async listDeliveryLocations(principal: SessionPrincipal, query: MasterDataListDto) {
    const scope = await this.resolveScope(principal);
    const isDriver = principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');
    let sppgOrganizationId: string | undefined;
    if (query.sppgId) {
      const sppg = await this.prisma.db.sppg.findUnique({
        where: { id: query.sppgId },
        select: { organizationId: true },
      });
      if (!sppg) {
        return this.page([], 0, query);
      }
      sppgOrganizationId = sppg.organizationId;
    }
    const where: Prisma.DeliveryLocationWhereInput = {
      ...(scope.global
        ? {}
        : isDriver
          ? { id: { in: [] } }
          : {
            OR: [
              { organizationId: { in: scope.directOrganizationIds } },
              { regionId: { in: [...scope.regionIds, ...scope.sppgRegionIds] } },
            ],
          }),
      ...(sppgOrganizationId
        ? { organizationId: sppgOrganizationId }
        : query.organizationId
          ? { organizationId: query.organizationId }
          : {}),
      ...(query.regionId ? { regionId: query.regionId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.deliveryLocation.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          organizationId: true,
          regionId: true,
          code: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.db.deliveryLocation.count({ where }),
    ]);
    return this.page(data, total, query);
  }

  async listVehicles(principal: SessionPrincipal, query: MasterDataListDto, tenantContext?: { tenantId: string } | null) {
    const scope = await this.resolveScope(principal);
    const isDriver = principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');
    const where: Prisma.VehicleWhereInput = {
      ...(tenantContext?.tenantId ? { tenantId: tenantContext.tenantId } : {}),
      ...(scope.global
        ? {}
        : isDriver
          ? { id: { in: [] } }
          : {
            OR: [
              { organizationId: { in: scope.directOrganizationIds } },
              { sppg: { is: { regionId: { in: scope.regionIds } } } },
              { sppgId: { in: scope.sppgIds } },
            ],
          }),
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.sppgId ? { sppgId: query.sppgId } : {}),
      ...(query.regionId ? { sppg: { is: { regionId: query.regionId } } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.vehicle.findMany({
        where,
        orderBy: { plateNumber: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          organizationId: true,
          sppgId: true,
          plateNumber: true,
          label: true,
          capacity: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.db.vehicle.count({ where }),
    ]);
    return this.page(data, total, query);
  }

  async listDrivers(principal: SessionPrincipal, query: MasterDataListDto, tenantContext?: { tenantId: string } | null) {
    const scope = await this.resolveScope(principal);
    const isDriver = principal.driverId !== null || principal.roles.some((role) => role.code === 'DRIVER');
    const where: Prisma.DriverWhereInput = {
      ...(tenantContext?.tenantId ? { tenantId: tenantContext.tenantId } : {}),
      ...(scope.global
        ? {}
        : isDriver
          ? principal.driverId ? { id: principal.driverId } : { id: { in: [] } }
          : {
              OR: [
                { sppgId: { in: scope.sppgIds } },
                { sppg: { is: { regionId: { in: scope.regionIds } } } },
                { sppg: { is: { organizationId: { in: scope.directOrganizationIds } } } },
              ],
            }),
      ...(query.organizationId || query.regionId
        ? {
            sppg: {
              is: {
                ...(query.organizationId ? { organizationId: query.organizationId } : {}),
                ...(query.regionId ? { regionId: query.regionId } : {}),
              },
            },
          }
        : {}),
      ...(query.sppgId ? { sppgId: query.sppgId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.driver.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          sppgId: true,
          userId: true,
          code: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.db.driver.count({ where }),
    ]);
    return this.page(data, total, query);
  }

  async nextDriverCode(sppgId: string, principal: SessionPrincipal) {
    const sppg = await this.prisma.db.sppg.findUnique({
      where: { id: sppgId },
      select: { id: true, organizationId: true, regionId: true, status: true },
    });
    if (!sppg || sppg.status === SppgStatus.SUSPENDED || sppg.status === SppgStatus.ARCHIVED) {
      throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    }
    this.assertSppgAccess(principal, sppg);

    const existing = await this.prisma.db.driver.findMany({
      where: { sppgId },
      select: { code: true },
    });
    const used = new Set(existing.map((row) => row.code.toUpperCase()));
    let maxSeq = 0;
    for (const row of existing) {
      const match = row.code.match(/^DRV[-_]?(\d+)$/i);
      if (match) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > maxSeq) maxSeq = value;
      }
    }
    let seq = Math.max(1, maxSeq + 1);
    let code = `DRV-${String(seq).padStart(3, '0')}`;
    while (used.has(code.toUpperCase())) {
      seq += 1;
      code = `DRV-${String(seq).padStart(3, '0')}`;
    }
    return { code };
  }

  createOrganization(
    input: CreateOrganizationDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    if (!principal.roles.some((role) => role.isGlobal)) {
      throw new ForbiddenException({ code: 'GLOBAL_SCOPE_REQUIRED' });
    }
    return this.createWithAudit(
      (tx) => tx.organization.create({
        data: { code: input.code.trim().toUpperCase(), name: input.name.trim() },
      }),
      principal,
      'organization.create',
      'organization',
      input.reason,
      requestId,
    );
  }

  async createRegion(
    input: CreateRegionDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const organization = await this.prisma.db.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, active: true },
    });
    if (!organization || !organization.active) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });
    await this.assertOrganizationAccess(organization.id, principal);
    return this.createWithAudit(
      (tx) => tx.region.create({
        data: {
          organizationId: organization.id,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
        },
      }),
      principal,
      'region.create',
      'region',
      input.reason,
      requestId,
    );
  }

  async createSppg(
    input: CreateSppgDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const region = await this.prisma.db.region.findFirst({
      where: { id: input.regionId, organizationId: input.organizationId, active: true },
      select: { id: true, organizationId: true },
    });
    if (!region) throw new NotFoundException({ code: 'REGION_NOT_FOUND' });
    await this.assertRegionAccess(region.id, region.organizationId, principal);

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const sppg = await tx.sppg.create({
          data: {
            organizationId: region.organizationId,
            regionId: region.id,
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            address: input.address?.trim(),
            latitude: input.latitude,
            longitude: input.longitude,
            status: SppgStatus.PENDING,
          },
        });
        await tx.$executeRaw`
          UPDATE sppgs
          SET coordinates = ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
          WHERE id = ${sppg.id}::uuid
        `;
        await this.writeAudit(tx, principal, 'sppg.create', 'sppg', sppg.id, input.reason, null, {
          code: sppg.code,
          status: sppg.status,
          regionId: sppg.regionId,
          latitude: input.latitude,
          longitude: input.longitude,
        }, requestId);
        return this.presentSppg(sppg);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async createDeliveryLocation(
    input: CreateDeliveryLocationDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const region = await this.prisma.db.region.findFirst({
      where: { id: input.regionId, organizationId: input.organizationId, active: true },
      select: { id: true, organizationId: true },
    });
    if (!region) throw new NotFoundException({ code: 'REGION_NOT_FOUND' });
    await this.assertRegionAccess(region.id, region.organizationId, principal);

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const location = await tx.deliveryLocation.create({
          data: {
            organizationId: region.organizationId,
            regionId: region.id,
            code: input.code.trim().toUpperCase(),
            name: input.name.trim(),
            address: input.address?.trim(),
            latitude: input.latitude,
            longitude: input.longitude,
          },
        });
        await tx.$executeRaw`
          UPDATE delivery_locations
          SET coordinates = ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography
          WHERE id = ${location.id}::uuid
        `;
        await this.writeAudit(tx, principal, 'delivery_location.create', 'delivery_location', location.id, input.reason, null, {
          code: location.code,
          regionId: location.regionId,
          latitude: input.latitude,
          longitude: input.longitude,
        }, requestId);
        return this.presentDeliveryLocation(location);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async createVehicle(
    input: CreateVehicleDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const sppg = await this.prisma.db.sppg.findUnique({
      where: { id: input.sppgId },
      select: { id: true, organizationId: true, regionId: true, status: true },
    });
    if (!sppg || sppg.status === SppgStatus.SUSPENDED || sppg.status === SppgStatus.ARCHIVED) {
      throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    }
    this.assertSppgAccess(principal, sppg);

    const tenant = await this.prisma.db.tenant.findUnique({ where: { legacySppgId: sppg.id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });

    return this.createWithAudit(
      (tx) => tx.vehicle.create({
        data: {
          tenantId: tenant.id,
          organizationId: sppg.organizationId,
          sppgId: sppg.id,
          plateNumber: input.plateNumber.trim().toUpperCase(),
          label: input.label?.trim(),
          capacity: input.capacity,
        },
      }),
      principal,
      'vehicle.create',
      'vehicle',
      input.reason,
      requestId,
    );
  }

  async createDriver(
    input: CreateDriverDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const sppg = await this.prisma.db.sppg.findUnique({
      where: { id: input.sppgId },
      select: { id: true, organizationId: true, regionId: true, status: true },
    });
    if (!sppg || sppg.status === SppgStatus.SUSPENDED || sppg.status === SppgStatus.ARCHIVED) {
      throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    }
    this.assertSppgAccess(principal, sppg);

    const tenant = await this.prisma.db.tenant.findUnique({ where: { legacySppgId: sppg.id } });
    if (!tenant) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });

    return this.createWithAudit(
      (tx) => tx.driver.create({
        data: {
          tenantId: tenant.id,
          sppgId: sppg.id,
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          phone: input.phone?.trim(),
          status: DriverStatus.ACTIVE,
        },
      }),
      principal,
      'driver.create',
      'driver',
      input.reason,
      requestId,
    );
  }

  async listAssignments(principal: SessionPrincipal, query: ListAssignmentsDto) {
    const scope = await this.resolveScope(principal);
    const where: Prisma.DriverVehicleAssignmentWhereInput = {
      ...(scope.global
        ? {}
        : {
            OR: [
              { organizationId: { in: scope.directOrganizationIds } },
              { sppg: { is: { regionId: { in: scope.regionIds } } } },
              { sppgId: { in: scope.sppgIds } },
            ],
          }),
      ...(query.sppgId ? { sppgId: query.sppgId } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.db.driverVehicleAssignment.findMany({
        where,
        orderBy: { effectiveFrom: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          driver: { select: { id: true, code: true, name: true } },
          vehicle: { select: { id: true, plateNumber: true, label: true } },
        },
      }),
      this.prisma.db.driverVehicleAssignment.count({ where }),
    ]);
    return this.page(data, total, query);
  }

  async createAssignment(
    input: CreateAssignmentDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
    if (!isValidRange(effectiveFrom, effectiveTo)) {
      throw new ConflictException({ code: 'ASSIGNMENT_RANGE_INVALID' });
    }

    const sppg = await this.prisma.db.sppg.findUnique({
      where: { id: input.sppgId },
      select: { id: true, organizationId: true, regionId: true, status: true },
    });
    if (!sppg || sppg.status === SppgStatus.SUSPENDED || sppg.status === SppgStatus.ARCHIVED) {
      throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    }
    this.assertSppgAccess(principal, sppg);

    const [driver, vehicle] = await Promise.all([
      this.prisma.db.driver.findUnique({
        where: { id: input.driverId },
        select: { id: true, sppgId: true, status: true },
      }),
      this.prisma.db.vehicle.findUnique({
        where: { id: input.vehicleId },
        select: { id: true, sppgId: true, status: true },
      }),
    ]);
    if (!driver || driver.sppgId !== sppg.id || driver.status !== DriverStatus.ACTIVE) {
      throw new NotFoundException({ code: 'DRIVER_NOT_FOUND' });
    }
    if (!vehicle || vehicle.sppgId !== sppg.id || vehicle.status !== VehicleStatus.ACTIVE) {
      throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND' });
    }

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const overlap = await tx.driverVehicleAssignment.findFirst({
          where: {
            effectiveFrom: { lt: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
            AND: [
              { OR: [{ driverId: driver.id }, { vehicleId: vehicle.id }] },
              { OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }] },
            ],
          },
          select: { id: true },
        });
        if (overlap) throw new ConflictException({ code: 'ASSIGNMENT_OVERLAP' });

        const assignment = await tx.driverVehicleAssignment.create({
          data: {
            organizationId: sppg.organizationId,
            sppgId: sppg.id,
            driverId: driver.id,
            vehicleId: vehicle.id,
            effectiveFrom,
            effectiveTo,
            reason: input.reason.trim(),
            createdBy: principal.id,
          },
          include: {
            driver: { select: { id: true, code: true, name: true } },
            vehicle: { select: { id: true, plateNumber: true, label: true } },
          },
        });
        await this.writeAudit(
          tx,
          principal,
          'driver_vehicle_assignment.create',
          'driver_vehicle_assignment',
          assignment.id,
          input.reason,
          null,
          {
            sppgId: sppg.id,
            driverId: driver.id,
            vehicleId: vehicle.id,
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo ?? null,
          },
          requestId,
        );
        return assignment;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException({ code: 'ASSIGNMENT_CONFLICT' });
      }
      this.rethrowUniqueConflict(error);
    }
  }

  async endAssignment(
    id: string,
    input: EndAssignmentDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const assignment = await this.prisma.db.driverVehicleAssignment.findUnique({
      where: { id },
      include: { sppg: { select: { id: true, organizationId: true, regionId: true } } },
    });
    if (!assignment) throw new NotFoundException({ code: 'ASSIGNMENT_NOT_FOUND' });
    this.assertSppgAccess(principal, assignment.sppg);

    const effectiveTo = new Date(input.effectiveTo);
    if (!isValidRange(assignment.effectiveFrom, effectiveTo)) {
      throw new ConflictException({ code: 'ASSIGNMENT_RANGE_INVALID' });
    }

    return this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.driverVehicleAssignment.update({
        where: { id },
        data: {
          effectiveTo,
          reason: input.reason.trim(),
        },
      });
      await this.writeAudit(
        tx,
        principal,
        'driver_vehicle_assignment.end',
        'driver_vehicle_assignment',
        id,
        input.reason,
        { effectiveTo: assignment.effectiveTo, reason: assignment.reason },
        { effectiveTo: updated.effectiveTo, reason: updated.reason },
        requestId,
      );
      return updated;
    });
  }

  async updateOrganization(
    id: string,
    input: UpdateOrganizationDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    if (!principal.roles.some((role) => role.isGlobal)) {
      throw new ForbiddenException({ code: 'GLOBAL_SCOPE_REQUIRED' });
    }
    const before = await this.prisma.db.organization.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });

    return this.prisma.db.$transaction(async (tx) => {
      const after = await tx.organization.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await this.writeAudit(
        tx,
        principal,
        'organization.update',
        'organization',
        id,
        input.reason,
        { name: before.name, active: before.active },
        { name: after.name, active: after.active },
        requestId,
      );
      return after;
    });
  }

  async updateRegion(
    id: string,
    input: UpdateRegionDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const before = await this.prisma.db.region.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'REGION_NOT_FOUND' });
    await this.assertRegionAccess(before.id, before.organizationId, principal);

    return this.prisma.db.$transaction(async (tx) => {
      const after = await tx.region.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await this.writeAudit(
        tx,
        principal,
        'region.update',
        'region',
        id,
        input.reason,
        { name: before.name, active: before.active },
        { name: after.name, active: after.active },
        requestId,
      );
      return after;
    });
  }

  async updateSppg(
    id: string,
    input: UpdateSppgDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const before = await this.prisma.db.sppg.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
    this.assertSppgAccess(principal, before);
    if (input.status !== undefined && input.status !== before.status) {
      throw new ConflictException({ code: 'SPPG_STATUS_CHANGE_REQUIRES_APPROVAL' });
    }

    const latitude = input.latitude ?? (before.latitude === null ? null : Number(before.latitude));
    const longitude = input.longitude ?? (before.longitude === null ? null : Number(before.longitude));
    if ((latitude === null) !== (longitude === null)) {
      throw new ConflictException({ code: 'SPPG_COORDINATES_INCOMPLETE' });
    }

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const updated = await tx.sppg.updateMany({
          where: { id, version: input.version },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.address !== undefined ? { address: input.address?.trim() ?? null } : {}),
            ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            version: { increment: 1 },
          },
        });
        if (updated.count === 0) throw new ConflictException({ code: 'MASTER_DATA_VERSION_CONFLICT' });

        if (latitude !== null && longitude !== null) {
          await tx.$executeRaw`
            UPDATE sppgs
            SET coordinates = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
            WHERE id = ${id}::uuid
          `;
        }
        const after = await tx.sppg.findUniqueOrThrow({ where: { id } });
        await this.writeAudit(
          tx,
          principal,
          'sppg.update',
          'sppg',
          id,
          input.reason,
          {
            name: before.name,
            address: before.address,
            latitude: before.latitude,
            longitude: before.longitude,
            status: before.status,
            version: before.version,
          },
          {
            name: after.name,
            address: after.address,
            latitude: after.latitude,
            longitude: after.longitude,
            status: after.status,
            version: after.version,
          },
          requestId,
        );
        return this.presentSppg(after);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async updateDeliveryLocation(
    id: string,
    input: UpdateDeliveryLocationDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const before = await this.prisma.db.deliveryLocation.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'DELIVERY_LOCATION_NOT_FOUND' });
    await this.assertRegionAccess(before.regionId, before.organizationId, principal);

    const latitude = input.latitude ?? (before.latitude === null ? null : Number(before.latitude));
    const longitude = input.longitude ?? (before.longitude === null ? null : Number(before.longitude));
    if ((latitude === null) !== (longitude === null)) {
      throw new ConflictException({ code: 'DELIVERY_LOCATION_COORDINATES_INCOMPLETE' });
    }

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const after = await tx.deliveryLocation.update({
          where: { id },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.address !== undefined ? { address: input.address?.trim() ?? null } : {}),
            ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          },
        });
        if (latitude !== null && longitude !== null) {
          await tx.$executeRaw`
            UPDATE delivery_locations
            SET coordinates = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
            WHERE id = ${id}::uuid
          `;
        }
        await this.writeAudit(
          tx,
          principal,
          'delivery_location.update',
          'delivery_location',
          id,
          input.reason,
          {
            name: before.name,
            address: before.address,
            latitude: before.latitude,
            longitude: before.longitude,
            active: before.active,
          },
          {
            name: after.name,
            address: after.address,
            latitude: after.latitude,
            longitude: after.longitude,
            active: after.active,
          },
          requestId,
        );
        return this.presentDeliveryLocation(after);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async updateVehicle(
    id: string,
    input: UpdateVehicleDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const before = await this.prisma.db.vehicle.findUnique({
      where: { id },
      include: { sppg: { select: { id: true, organizationId: true, regionId: true } } },
    });
    if (!before) throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND' });
    this.assertSppgAccess(principal, before.sppg);

    return this.prisma.db.$transaction(async (tx) => {
      const after = await tx.vehicle.update({
        where: { id },
        data: {
          ...(input.label !== undefined ? { label: input.label?.trim() ?? null } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      await this.writeAudit(
        tx,
        principal,
        'vehicle.update',
        'vehicle',
        id,
        input.reason,
        { label: before.label, capacity: before.capacity, status: before.status },
        { label: after.label, capacity: after.capacity, status: after.status },
        requestId,
      );
      return after;
    });
  }

  async updateDriver(
    id: string,
    input: UpdateDriverDto,
    principal: SessionPrincipal,
    requestId: string,
  ) {
    const before = await this.prisma.db.driver.findUnique({
      where: { id },
      include: { sppg: { select: { id: true, organizationId: true, regionId: true } } },
    });
    if (!before) throw new NotFoundException({ code: 'DRIVER_NOT_FOUND' });
    this.assertSppgAccess(principal, before.sppg);

    return this.prisma.db.$transaction(async (tx) => {
      const after = await tx.driver.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone?.trim() ?? null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      await this.writeAudit(
        tx,
        principal,
        'driver.update',
        'driver',
        id,
        input.reason,
        { name: before.name, phone: before.phone, status: before.status },
        { name: after.name, phone: after.phone, status: after.status },
        requestId,
      );
      return after;
    });
  }

  private async resolveScope(principal: SessionPrincipal): Promise<Scope> {
    if (principal.roles.some((role) => role.isGlobal)) {
      return {
        global: true,
        organizationIds: [],
        directOrganizationIds: [],
        regionIds: [],
        sppgIds: [],
        sppgRegionIds: [],
      };
    }

    // Tenant users: resolve scope from tenant's SPPG
    if (principal.tenantRole) {
      const membership = await this.prisma.db.tenantMembership.findFirst({
        where: { userId: principal.id, status: 'ACTIVE' },
        select: { tenantId: true },
      });
      if (membership?.tenantId) {
        const tenant = await this.prisma.db.tenant.findUnique({
          where: { id: membership.tenantId },
          select: { legacySppgId: true },
        });
        if (tenant?.legacySppgId) {
          const sppg = await this.prisma.db.sppg.findUnique({
            where: { id: tenant.legacySppgId },
            select: { id: true, regionId: true, organizationId: true },
          });
          if (sppg) {
            return {
              global: false,
              organizationIds: [sppg.organizationId],
              directOrganizationIds: [sppg.organizationId],
              regionIds: [sppg.regionId],
              sppgIds: [sppg.id],
              sppgRegionIds: [sppg.regionId],
            };
          }
        }
      }
    }

    const directOrganizationIds = principal.roles.flatMap(
      (role) => role.organizationId ? [role.organizationId] : [],
    );
    const organizationIds = new Set(
      principal.roles.flatMap((role) => role.organizationId ? [role.organizationId] : []),
    );
    const regionIds = new Set(
      principal.roles.flatMap((role) => role.regionId ? [role.regionId] : []),
    );
    const sppgIds = new Set(
      principal.roles.flatMap((role) => role.sppgId ? [role.sppgId] : []),
    );

    const [regions, sppgs] = await Promise.all([
      regionIds.size
        ? this.prisma.db.region.findMany({
            where: { id: { in: [...regionIds] } },
            select: { id: true, organizationId: true },
          })
        : [],
      sppgIds.size
        ? this.prisma.db.sppg.findMany({
            where: { id: { in: [...sppgIds] } },
            select: { id: true, regionId: true, organizationId: true },
          })
        : [],
    ]);
    for (const region of regions) organizationIds.add(region.organizationId);
    const sppgRegionIds = [...new Set(sppgs.map((sppg) => sppg.regionId))];
    for (const sppg of sppgs) organizationIds.add(sppg.organizationId);

    return {
      global: false,
      organizationIds: [...organizationIds],
      directOrganizationIds,
      regionIds: [...regionIds],
      sppgIds: [...sppgIds],
      sppgRegionIds,
    };
  }

  private async assertOrganizationAccess(organizationId: string, principal: SessionPrincipal) {
    const scope = await this.resolveScope(principal);
    if (!scope.global && !scope.directOrganizationIds.includes(organizationId)) {
      throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });
    }
  }

  private async assertRegionAccess(
    regionId: string,
    organizationId: string,
    principal: SessionPrincipal,
  ) {
    const scope = await this.resolveScope(principal);
    if (
      !scope.global &&
      !scope.directOrganizationIds.includes(organizationId) &&
      !scope.regionIds.includes(regionId)
    ) {
      throw new NotFoundException({ code: 'REGION_NOT_FOUND' });
    }
  }

  private assertSppgAccess(
    principal: SessionPrincipal,
    target: { id: string; organizationId: string; regionId: string },
  ) {
    const inScope = principal.roles.some(
      (role) =>
        role.isGlobal ||
        role.organizationId === target.organizationId ||
        role.regionId === target.regionId ||
        role.sppgId === target.id,
    );
    if (!inScope) throw new NotFoundException({ code: 'SPPG_NOT_FOUND' });
  }

  private async createWithAudit<T extends { id: string }>(
    create: (tx: Prisma.TransactionClient) => Promise<T>,
    principal: SessionPrincipal,
    action: string,
    entityType: string,
    reason: string,
    requestId: string,
  ) {
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const record = await create(tx);
        await this.writeAudit(tx, principal, action, entityType, record.id, reason, null, { id: record.id }, requestId);
        return record;
      });
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    principal: SessionPrincipal,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    before: Prisma.InputJsonValue | null,
    after: Prisma.InputJsonValue,
    requestId: string,
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: principal.id,
        action,
        entityType,
        entityId,
        result: 'success',
        reason,
        before: before ?? Prisma.JsonNull,
        after,
        requestId,
      },
    });
  }

  private presentSppg<T extends {
    id: string;
    organizationId: string;
    regionId: string;
    code: string;
    name: string;
    address: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    status: SppgStatus;
    version: number;
  }>(record: T) {
    return {
      id: record.id,
      organizationId: record.organizationId,
      regionId: record.regionId,
      code: record.code,
      name: record.name,
      address: record.address,
      latitude: record.latitude,
      longitude: record.longitude,
      status: record.status,
      version: record.version,
    };
  }

  private presentDeliveryLocation<T extends {
    id: string;
    organizationId: string;
    regionId: string;
    code: string;
    name: string;
    address: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    active: boolean;
  }>(record: T) {
    return {
      id: record.id,
      organizationId: record.organizationId,
      regionId: record.regionId,
      code: record.code,
      name: record.name,
      address: record.address,
      latitude: record.latitude,
      longitude: record.longitude,
      active: record.active,
    };
  }

  private page<T>(data: T[], total: number, query: MasterDataListDto) {
    return {
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  private rethrowUniqueConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({ code: 'MASTER_DATA_CONFLICT' });
    }
    throw error;
  }
}
