import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class IssueQrTokenDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(900)
  expiresInSeconds = 300;
}

export class OverrideArrivalDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(3, 2000)
  evidenceNote?: string;
}

export class VerifyArrivalDto {
  @IsString()
  @Length(32, 128)
  qrToken!: string;

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
}
