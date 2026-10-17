import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '../../common/pagination';

/** A product that is not in the catalogue yet. It is created when it is received. */
export class NewProductDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  @Length(1, 50)
  categoryCode: string;

  /** Defaults to PCS. */
  @IsOptional()
  @IsString()
  @Length(1, 30)
  unit?: string;

  /** Optional: left empty, one is generated and can be changed later. */
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;
}

export class PurchaseOrderItemDto {
  /** An existing product. Leave it out and send [newProduct] for a new one. */
  @IsOptional()
  @IsString()
  @Length(1, 50)
  productCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NewProductDto)
  newProduct?: NewProductDto;

  /** Required when the product has variants. */
  @IsOptional()
  @IsString()
  @Length(1, 50)
  variantCode?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @Length(1, 50)
  supplierCode: string;

  /** The warehouse the goods are delivered to. */
  @IsString()
  @Length(1, 50)
  warehouseCode: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** true = send for approval straight away; otherwise it stays a draft. */
  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

export class RejectPurchaseOrderDto {
  @IsString()
  @Length(1, 500)
  reason: string;
}

export class ReceiveItemDto {
  /** The purchase_order_items id (not the product). */
  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class ReceivePurchaseOrderDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];
}

export class PurchaseOrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
  ])
  status?: string;
}
