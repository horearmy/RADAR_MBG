import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export enum GeofenceLocationType {
  SPPG = 'SPPG',
  DELIVERY = 'DELIVERY',
}

export class CreateGeofenceDto {
  @IsEnum(GeofenceLocationType)
  locationType!: GeofenceLocationType;

  @IsUUID()
  locationId!: string;

  @IsString()
  @Length(3, 160)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  centerLatitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  centerLongitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  @Max(10_000)
  radiusMeters!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  minGpsAccuracyMeters = 50;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(10)
  confirmationFixes = 2;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  confirmationDurationSeconds = 10;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class ListGeofencesDto {
  @IsEnum(GeofenceLocationType)
  locationType!: GeofenceLocationType;

  @IsUUID()
  locationId!: string;
}
