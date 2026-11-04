import { Type } from 'class-transformer';
import { SppgStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export enum ApprovalDecisionInput {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class CreateSppgStatusApprovalDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsEnum(SppgStatus)
  targetStatus!: SppgStatus;

  @IsString()
  @Length(3, 2000)
  @Matches(/\S/)
  reason!: string;
}

export class DecideApprovalDto {
  @IsEnum(ApprovalDecisionInput)
  decision!: ApprovalDecisionInput;

  @IsString()
  @Length(3, 2000)
  @Matches(/\S/)
  reason!: string;
}

export class ListApprovalRequestsDto {
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
