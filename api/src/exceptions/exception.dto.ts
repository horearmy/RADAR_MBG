import { Transform, Type } from 'class-transformer';
import {
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ExceptionCloseOutcome {
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  DUPLICATE = 'DUPLICATE',
  CLOSED_WITH_NOTE = 'CLOSED_WITH_NOTE',
}

export class CreateExceptionDto {
  @IsEnum(ExceptionSource)
  source!: ExceptionSource;

  @IsOptional()
  @IsUUID()
  sppgId?: string;

  @IsOptional()
  @IsUUID()
  tripId?: string;

  @IsString()
  @Length(3, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(3, 4000)
  details?: string;

  @IsOptional()
  @IsEnum(ExceptionSeverity)
  severity?: ExceptionSeverity;

  @IsOptional()
  @IsString()
  @Length(3, 160)
  dedupeKey?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class ListExceptionsDto {
  @IsOptional()
  @IsEnum(ExceptionStatus)
  status?: ExceptionStatus;

  @IsOptional()
  @IsEnum(ExceptionSeverity)
  severity?: ExceptionSeverity;

  @IsOptional()
  @IsEnum(ExceptionSource)
  source?: ExceptionSource;

  @IsOptional()
  @IsUUID()
  tripId?: string;

  @IsOptional()
  @IsUUID()
  sppgId?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  assignedToMe?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export class ListExceptionAssigneesDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class TriageExceptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsEnum(ExceptionSeverity)
  severity!: ExceptionSeverity;

  @IsString()
  @Length(3, 2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(3, 4000)
  note?: string;
}

export class AssignExceptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsUUID()
  assigneeUserId!: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(3, 4000)
  note?: string;
}

export class InvestigateExceptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(3, 4000)
  note?: string;
}

export class ResolveExceptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 4000)
  resolutionNote!: string;

  @IsString()
  @Length(3, 2000)
  reason!: string;
}

export class EscalateExceptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @Length(3, 2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(3, 4000)
  note?: string;
}

export class CloseExceptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsEnum(ExceptionCloseOutcome)
  outcome!: ExceptionCloseOutcome;

  @IsString()
  @Length(3, 2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(3, 4000)
  note?: string;
}
