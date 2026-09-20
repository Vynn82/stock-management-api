import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @Length(1, 50)
  code: string;

  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  phone?: string;
}
