import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum GeofenceLocationType {
  SPPG = 'SPPG',
  DELIVERY = 'DELIVERY',
}

export enum GeofenceShapeType {
  CIRCLE = 'CIRCLE',
  POLYGON = 'POLYGON',
}

export class CreateGeofenceDto {
  @IsEnum(GeofenceLocationType)
  locationType!: GeofenceLocationType;

  @IsUUID()
  locationId!: string;

  @IsEnum(GeofenceShapeType)
  shapeType: GeofenceShapeType = GeofenceShapeType.CIRCLE;

  @IsString()
  @Length(3, 160)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  centerLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  centerLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  @Max(10_000)
  radiusMeters?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => GeofencePointDto)
  polygonCoordinates?: GeofencePointDto[];

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

export class GeofencePointDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;
}

export class ListGeofencesDto {
  @IsEnum(GeofenceLocationType)
  locationType!: GeofenceLocationType;

  @IsUUID()
  locationId!: string;
}
