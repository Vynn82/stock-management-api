import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLoyaltyTierDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  tierRank: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrders: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSpending: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  badgeIcon?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLoyaltyTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  tierRank?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrders?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSpending?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  badgeIcon?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

