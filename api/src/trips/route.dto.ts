import { Type } from 'class-transformer';
import {
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
import { ArrayMaxSize, ArrayMinSize } from 'class-validator';

export enum RouteLocationType {
  SPPG = 'SPPG',
  DELIVERY = 'DELIVERY',
}

export class RoutePointDto {
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

export class CreateRouteDto {
  @IsString()
  @Length(3, 160)
  name!: string;

  @IsUUID()
  sppgId!: string;

  @IsUUID()
  deliveryLocationId!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  coordinates!: RoutePointDto[];

  @IsOptional()
  @IsString()
  @Length(3, 2000)
  reason?: string;
}

export class ListRoutesDto {
  @IsOptional()
  @IsUUID()
  sppgId?: string;

  @IsOptional()
  @IsUUID()
  deliveryLocationId?: string;

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