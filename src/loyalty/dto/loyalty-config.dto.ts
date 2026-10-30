import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  LoyaltyDowngradePolicy,
  LoyaltyStackingPolicy,
} from '../entities/loyalty-config.entity';

export class UpdateLoyaltyConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minProfitMarginPercent?: number;

  @IsOptional()
  @IsEnum(LoyaltyDowngradePolicy)
  downgradePolicy?: LoyaltyDowngradePolicy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsEnum(LoyaltyStackingPolicy)
  stackingPolicy?: LoyaltyStackingPolicy;

  @IsOptional()
  @IsArray()
  excludedProductIds?: string[];

  @IsOptional()
  @IsArray()
  excludedCategoryIds?: string[];
}

