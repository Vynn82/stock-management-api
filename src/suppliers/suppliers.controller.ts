import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaginationDto } from '../common/pagination';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @RequirePermission('SUPPLIER_MANAGE')
  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @RequirePermission('SUPPLIER_VIEW')
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.suppliersService.findAll(query);
  }

  @RequirePermission('SUPPLIER_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @RequirePermission('SUPPLIER_MANAGE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @RequirePermission('SUPPLIER_MANAGE')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.suppliersService.deactivate(id);
  }

  @RequirePermission('SUPPLIER_MANAGE')
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.suppliersService.activate(id);
  }
}
