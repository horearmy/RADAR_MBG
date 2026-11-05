import { IsEmail, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateRecipientRegistrationCodeDto {}

export class CreateRecipientRegistrationRequestDto {
  @IsString()
  @Length(4, 64)
  code!: string;

  @IsString()
  @Length(2, 160)
  requesterName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @Length(0, 160)
  requestedSiteName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}

export class ReviewRecipientRegistrationRequestDto {
  @IsString()
  @Matches(/^(APPROVE|REJECT|REVISION_REQUIRED)$/)
  decision!: 'APPROVE' | 'REJECT' | 'REVISION_REQUIRED';

  @IsOptional()
  @IsUUID()
  recipientSiteId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  reviewNotes?: string;
}