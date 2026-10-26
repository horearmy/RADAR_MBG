import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GpsPositionDto {
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

  @IsISO8601()
  deviceTimestamp!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(150)
  speedMps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(359.99)
  headingDegrees?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequenceNumber?: number;
}

export class TrackQueryDto {
  @IsOptional()
  @IsUUID()
  cursorId?: string;

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
  @Max(5000)
  limit = 1000;
}
