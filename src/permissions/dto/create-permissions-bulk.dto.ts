import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';

import { CreatePermissionDto } from './create-permission.dto';

export class CreatePermissionsBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePermissionDto)
  permissions: CreatePermissionDto[];
}
