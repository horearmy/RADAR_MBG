import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class SubmitDeliveryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  receivedQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  damagedQuantity = 0;

  @IsOptional()
  @IsString()
  @Length(3, 2000)
  varianceReason?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  confirmationNote?: string;

  @IsOptional()
  @IsISO8601()
  deviceTimestamp?: string;
}

export class ReviewDeliveryDto {
  @IsIn(['ACCEPT', 'REJECT'])
  decision!: 'ACCEPT' | 'REJECT';

  @IsString()
  @Length(3, 2000)
  reason!: string;
}
