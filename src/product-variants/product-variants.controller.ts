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

import { ProductVariantsService } from './product-variants.service';

import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { PaginationDto } from '../common/pagination';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('product-variants')
export class ProductVariantsController {
  constructor(private readonly variantsService: ProductVariantsService) {}

  @RequirePermission('PRODUCT_CREATE')
  @Post()
  create(@Body() dto: CreateProductVariantDto) {
    return this.variantsService.create(dto);
  }

  @RequirePermission('PRODUCT_VIEW')
  @Get()
  findAll(
    @Query('productId') productId?: string,
    @Query() query?: PaginationDto,
  ) {
    return this.variantsService.findAll(productId, query);
  }

  @RequirePermission('PRODUCT_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.variantsService.findOne(id);
  }

  @RequirePermission('PRODUCT_UPDATE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductVariantDto) {
    return this.variantsService.update(id, dto);
  }

  @RequirePermission('PRODUCT_DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.variantsService.remove(id);
  }

  @RequirePermission('PRODUCT_UPDATE')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.variantsService.deactivate(id);
  }

  @RequirePermission('PRODUCT_UPDATE')
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.variantsService.activate(id);
  }
}
