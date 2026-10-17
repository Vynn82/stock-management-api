import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRequestStockDto {
  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  variantCode?: string;

  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  fromWarehouseCode?: string;

  @IsOptional()
  @IsString()
  toWarehouseCode?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
