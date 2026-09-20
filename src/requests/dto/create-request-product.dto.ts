// create-request-product.dto.ts

import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRequestProductDto {
  @IsString()
  productCode: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryCode?: string;

  @IsOptional()
  @IsString()
  brandCode?: string;

  @IsOptional()
  @IsString()
  supplierCode?: string;

  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  productSku?: string;

  @IsOptional()
  @IsString()
  productBarcode?: string;

  @IsOptional()
  @IsNumber()
  productCostPrice?: number;

  @IsOptional()
  @IsNumber()
  productSellingPrice?: number;

  @IsOptional()
  @IsNumber()
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  maximumStock?: number;
}
