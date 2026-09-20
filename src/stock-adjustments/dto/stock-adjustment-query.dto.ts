import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination';
import { StockAdjustmentType } from './create-stock-adjustment.dto';

export class StockAdjustmentQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsEnum(StockAdjustmentType)
  adjustmentType?: StockAdjustmentType;

  @IsOptional()
  @IsString()
  productCode?: string;

  @IsOptional()
  @IsString()
  warehouseCode?: string;
}
