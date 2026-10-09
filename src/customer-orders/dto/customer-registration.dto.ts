import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
