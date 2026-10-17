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
<<<<<<< HEAD
import { RequirePermission } from '../auth/decorators/permission.decorator';
=======
import { Public } from '../auth/decorators/public.decorator';
>>>>>>> f3cc2470de2f82d39b4ab61423685eb4c71b17a5

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @RequirePermission('CATEGORY_MANAGE')
  @Post()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

<<<<<<< HEAD
  @RequirePermission('CATEGORY_VIEW')
=======
  @Public()
>>>>>>> f3cc2470de2f82d39b4ab61423685eb4c71b17a5
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.categoriesService.findAll(query);
  }

<<<<<<< HEAD
  @RequirePermission('CATEGORY_VIEW')
=======
  @Public()
>>>>>>> f3cc2470de2f82d39b4ab61423685eb4c71b17a5
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
