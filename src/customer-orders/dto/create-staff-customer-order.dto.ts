import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StaffOrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CreateStaffCustomerOrderDto {
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StaffOrderItemDto)
  items: StaffOrderItemDto[];

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsString()
  @IsOptional()
  warehouseCode?: string;
}
