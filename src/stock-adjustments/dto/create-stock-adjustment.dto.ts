import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum StockAdjustmentType {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export class CreateStockAdjustmentItemDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsOptional()
  @IsString()
  variantCode?: string | null;

  @IsString()
  @IsNotEmpty()
  warehouseCode: string;

  @IsOptional()
  @IsEnum(StockAdjustmentType)
  adjustmentType?: StockAdjustmentType;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  location?: string;

  /** 'IN' / 'OUT' labels the movement as Stock In / Stock Out in history; leave out for a normal adjustment. */
  @IsOptional()
  @IsIn(['IN', 'OUT'])
  movementType?: 'IN' | 'OUT';
}

export class CreateStockAdjustmentDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockAdjustmentItemDto)
  adjustments?: CreateStockAdjustmentItemDto[];

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  variantCode?: string | null;

  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @IsOptional()
  @IsEnum(StockAdjustmentType)
  adjustmentType?: StockAdjustmentType;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(['IN', 'OUT'])
  movementType?: 'IN' | 'OUT';
}
