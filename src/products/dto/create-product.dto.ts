import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @Length(1, 50)
  code: string;

  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // =========================
  // MASTER DATA
  // =========================

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  // =========================
  // VARIANT
  // =========================

  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  // =========================
  // IDENTIFICATION
  // =========================

  @IsString()
  @Length(1, 30)
  unit: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  barcode?: string;

  @IsString()
  @Length(1, 100)
  sku: string;

  // =========================
  // PRICING
  // =========================

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  // =========================
  // STOCK RULES
  // =========================

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumStock?: number;
}
