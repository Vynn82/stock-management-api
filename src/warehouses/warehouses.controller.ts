import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { WarehousesService } from './warehouses.service';

import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from '../common/pagination';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @RequirePermission('WAREHOUSE_MANAGE')
  @Post()
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @RequirePermission('WAREHOUSE_VIEW')
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.warehousesService.findAll(query);
  }

  @RequirePermission('WAREHOUSE_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @RequirePermission('WAREHOUSE_MANAGE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  @RequirePermission('WAREHOUSE_MANAGE')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.warehousesService.deactivate(id);
  }

  @RequirePermission('WAREHOUSE_MANAGE')
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.warehousesService.activate(id);
  }
}
