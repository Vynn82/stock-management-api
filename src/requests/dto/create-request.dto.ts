// create-request.dto.ts

import { IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';

import { RequestType } from '../enum/request-type.enum';

import { CreateRequestProductDto } from './create-request-product.dto';
import { CreateRequestVariantDto } from './create-request-variant.dto';
import { CreateRequestStockDto } from './create-request-stock.dto';
import { CreateRequestApproverDto } from './create-request-approver.dto';
import { CreateRequestAdjustmentDto } from './create-request-adjustment.dto';

export class CreateRequestDto {
  @IsEnum(RequestType)
  requestType: RequestType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRequestProductDto)
  product?: CreateRequestProductDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequestVariantDto)
  variants?: CreateRequestVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequestStockDto)
  stock?: CreateRequestStockDto[];
  @IsOptional()
  remark?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequestApproverDto)
  approvers?: CreateRequestApproverDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRequestAdjustmentDto)
  adjustments?: CreateRequestAdjustmentDto[];
}
