import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OverrideCustomerTierDto {
  @IsOptional()
  @IsUUID()
  tierId?: string | null; // null to reset back to automated tier

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  expiryDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

