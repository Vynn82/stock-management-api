// create-request-variant.dto.ts

import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRequestVariantDto {
  @IsString()
  variantCode: string;

  @IsOptional()
  @IsString()
  variantName?: string;

  @IsOptional()
  @IsString()
  variantSku?: string;

  @IsOptional()
  @IsString()
  variantBarcode?: string;

  @IsOptional()
  @IsObject()
  variantAttributes?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  variantCostPrice?: number;

  @IsOptional()
  @IsNumber()
  variantSellingPrice?: number;
}
