import { Type } from 'class-transformer';
import {
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
} from 'class-validator';
import { TripStatus } from '@prisma/client';

export class ListTripsDto {
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

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

export class CreateTripDto {
  @IsUUID()
  sppgId!: string;

  @IsUUID()
  deliveryLocationId!: string;

  @IsUUID()
  vehicleId!: string;

  @IsUUID()
  driverId!: string;

  @IsISO8601()
  plannedDepartureAt!: string;

  @IsISO8601()
  plannedArrivalAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  plannedQuantity!: number;
}

export class RescheduleTripDto {
  @IsISO8601()
  plannedDepartureAt!: string;

  @IsISO8601()
  plannedArrivalAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class ReassignTripDto {
  @IsUUID()
  vehicleId!: string;

  @IsUUID()
  driverId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class ChangeDestinationDto {
  @IsUUID()
  deliveryLocationId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class CancelTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class StartTripDto {
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

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000)
  accuracyMeters!: number;

  @IsOptional()
  @IsISO8601()
  deviceTimestamp?: string;
}
