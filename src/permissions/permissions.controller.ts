import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { PermissionsService } from './permissions.service';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreatePermissionsBulkDto } from './dto/create-permissions-bulk.dto';
import { CreateResourceDto } from './dto/create-resource-dto';
import { PaginationDto } from '../common/pagination';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.permissionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }
  // @RequirePermission('PERMISSION_CREATE')
  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  //@RequirePermission('PERMISSION_BULK_CREATE')
  @Post('bulk')
  createBulk(@Body() dto: CreatePermissionsBulkDto) {
    return this.permissionsService.createBulk(dto.permissions);
  }

  // create permission by using only param resource

  @Post('resources')
  @RequirePermission('PERMISSION_CREATE')
  createResource(@Body() dto: CreateResourceDto) {
    return this.permissionsService.createResource(dto.resource);
  }
}
