import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerStatus } from '../enums/customer-status.enum';

export class CustomerRegisterDto {
  @IsString()
  @IsNotEmpty()
  initData: string;

  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  commune?: string;
}

export class RejectCustomerRegistrationDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CustomerQueryDto {
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
