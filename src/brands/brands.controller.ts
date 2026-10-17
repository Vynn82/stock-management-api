import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { BrandsService } from './brands.service';

import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { PaginationDto } from '../common/pagination';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @RequirePermission('BRAND_MANAGE')
  @Post()
  create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandsService.create(createBrandDto);
  }

  @RequirePermission('BRAND_VIEW')
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.brandsService.findAll(query);
  }

  @RequirePermission('BRAND_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  @RequirePermission('BRAND_MANAGE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBrandDto: UpdateBrandDto) {
    return this.brandsService.update(id, updateBrandDto);
  }

  @RequirePermission('BRAND_MANAGE')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.brandsService.deactivate(id);
  }

  @RequirePermission('BRAND_MANAGE')
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.brandsService.activate(id);
  }
}
