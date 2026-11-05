import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Matches,
} from 'class-validator';
import { DriverStatus, SppgStatus, VehicleStatus } from '@prisma/client';

export class MasterDataListDto {
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsUUID()
  sppgId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export class ListAssignmentsDto extends MasterDataListDto {
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}

export class CreateAssignmentDto {
  @IsUUID()
  sppgId!: string;

  @IsUUID()
  driverId!: string;

  @IsUUID()
  vehicleId!: string;

  @IsISO8601({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveTo?: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class EndAssignmentDto {
  @IsISO8601({ strict: true })
  effectiveTo!: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class CreateOrganizationDto {
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class CreateRegionDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class CreateSppgDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  regionId!: string;

  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  address?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class CreateDeliveryLocationDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  regionId!: string;

  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  address?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class CreateVehicleDto {
  @IsUUID()
  sppgId!: string;

  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Za-z0-9 -]+$/)
  plateNumber!: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  capacity?: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class UpdateRegionDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class UpdateSppgDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsEnum(SppgStatus)
  status?: SppgStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class UpdateDeliveryLocationDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  capacity?: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(6, 32)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  photoUrl?: string;

  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class CreateDriverDto {
  @IsUUID()
  sppgId!: string;

  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Za-z0-9._-]+$/)
  code!: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(6, 32)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  photoUrl?: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}
