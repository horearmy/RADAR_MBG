import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(1, 80)
  username!: string;

  @IsString()
  @Length(1, 128)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  otpCode?: string;

  @IsOptional()
  @IsString()
  @Length(16, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  recoveryCode?: string;
}

export class ConfirmMfaEnrollmentDto {
  @IsString()
  @Length(32, 64)
  @Matches(/^[A-Z2-7]+$/i)
  secret!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otpCode!: string;
}

export class BeginMfaRotationDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  otpCode?: string;

  @IsOptional()
  @IsString()
  @Length(16, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  recoveryCode?: string;
}

export class ConfirmMfaRotationDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otpCode!: string;
}

export class BeginMfaRecoveryDto {
  @IsString()
  @Length(32, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token!: string;

  @IsString()
  @Length(14, 128)
  password!: string;
}

export class ConfirmMfaRecoveryDto extends BeginMfaRecoveryDto {
  @IsString()
  @Matches(/^\d{6}$/)
  otpCode!: string;
}

export class ConsumeAccountTokenDto {
  @IsString()
  @Length(32, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token!: string;

  @IsString()
  @Length(14, 128)
  password!: string;
}
