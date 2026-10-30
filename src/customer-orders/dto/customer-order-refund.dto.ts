import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RefundType } from '../entities/customer-order-refund.entity';

export class RefundItemDto {
  @IsUUID()
  orderItemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class ProcessRefundDto {
  @IsEnum(RefundType)
  refundType: RefundType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items?: RefundItemDto[];
}

