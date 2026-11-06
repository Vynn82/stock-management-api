import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AskCustomerDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  proposedQuantity?: number;

  @IsOptional()
  @IsUUID()
  itemId?: string;
}

export enum CustomerResponseType {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  WAIT_STOCK = 'WAIT_STOCK',
  COUNTER_OFFER = 'COUNTER_OFFER',
  MESSAGE = 'MESSAGE',
}

export class CustomerResponseDto {
  @IsEnum(CustomerResponseType)
  responseType: CustomerResponseType;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  acceptedQuantity?: number;

  @IsOptional()
  @IsUUID()
  itemId?: string;
}

export class RecordPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class ConfirmQuantityDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0)
  approvedQuantity: number;

  @IsNumber()
  @Min(0)
  waitingQuantity: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class RejectOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
