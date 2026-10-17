import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CategoriesService } from './categories.service';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from '../common/pagination';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @RequirePermission('CATEGORY_MANAGE')
  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @RequirePermission('CATEGORY_VIEW')
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.categoriesService.findAll(query);
  }

  @RequirePermission('CATEGORY_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @RequirePermission('CATEGORY_MANAGE')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @RequirePermission('CATEGORY_MANAGE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
  @RequirePermission('CATEGORY_MANAGE')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.categoriesService.deactivate(id);
  }

  @RequirePermission('CATEGORY_MANAGE')
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.categoriesService.activate(id);
  }
}
