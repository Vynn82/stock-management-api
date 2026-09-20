import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { AdjustmentType } from '../enum/adjustment-type';

export class CreateRequestAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsOptional()
  @IsString()
  variantCode?: string | null;

  @IsString()
  @IsNotEmpty()
  warehouseCode: string;

  @IsEnum(AdjustmentType)
  adjustmentType: AdjustmentType;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

  @IsOptional()
  @IsNumber()
  basePrice?: number | null;

  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;
}
