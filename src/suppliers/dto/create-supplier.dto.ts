import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

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
}
