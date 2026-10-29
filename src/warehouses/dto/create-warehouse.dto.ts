import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
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

  /** Most units the warehouse may hold; leave empty (or null) for no limit. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(1)
  capacity?: number | null;
}
