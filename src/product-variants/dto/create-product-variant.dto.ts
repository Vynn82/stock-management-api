import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateProductVariantDto {
  @IsUUID()
  productId: string;

  @IsString()
  @Length(1, 100)
  code: string;

  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  @Length(1, 100)
  sku: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  barcode?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;
}
