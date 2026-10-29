import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

export const SUPPLIER_PLATFORMS = [
  'TELEGRAM',
  'WHATSAPP',
  'FACEBOOK',
  'WECHAT',
  'LINE',
  'INSTAGRAM',
  'WEBSITE',
  'OTHER',
];

export class CreateSupplierDto {
  @IsString()
  @Length(1, 50)
  code: string;

  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @Length(1, 150)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  /** One of SUPPLIER_PLATFORMS. */
  @IsOptional()
  @IsIn(SUPPLIER_PLATFORMS)
  platform?: string;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  platformLink?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;
}
