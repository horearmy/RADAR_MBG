import { Type } from 'class-transformer';
import { AccountStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateUserInvitationDto {
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsString()
  @Length(2, 160)
  @Matches(/\S/)
  displayName!: string;

  @IsString()
  @Length(3, 2000)
  @Matches(/\S/)
  reason!: string;
}

export class ListUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

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

export class UpdateUserStatusDto {
  @IsEnum(AccountStatus)
  status!: AccountStatus;

  @IsString()
  @Length(3, 2000)
  @Matches(/\S/)
  reason!: string;
}

export class RevokeUserSessionsDto {
  @IsString()
  @Length(3, 2000)
  @Matches(/\S/)
  reason!: string;
}

export class AssignUserRoleDto {
  @IsString()
  @Length(2, 64)
  roleCode!: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsUUID()
  sppgId?: string;

  @IsString()
  @Length(3, 2000)
  @Matches(/\S/)
  reason!: string;
}

export class RevokeUserRoleDto {
  @IsUUID()
  userRoleId!: string;

  @IsString()
  @Length(3, 2000)
  @Matches(/\S/)
  reason!: string;
}
