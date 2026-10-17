import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { ProductVariantsService } from './product-variants.service';
import { BarcodesService } from '../barcodes/barcodes.service';
import {
  GenerateBarcodeQueryDto,
  GenerateQrQueryDto,
  LabelQueryDto,
} from '../barcodes/dto/barcode-query.dto';

import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { PaginationDto } from '../common/pagination';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('product-variants')
export class ProductVariantsController {
  constructor(
    private readonly variantsService: ProductVariantsService,
    private readonly barcodesService: BarcodesService,
  ) {}

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

  /**
   * Stream 1D Barcode image (PNG or SVG) for this Product Variant.
   */
  @Get(':id/barcode')
  getBarcode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateBarcodeQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamVariantBarcode(id, query, res);
  }

  /**
   * Stream 2D QR Code image (PNG or SVG) for this Product Variant.
   */
  @Get(':id/qrcode')
  getQrCode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateQrQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamVariantQr(id, query, res);
  }

  /**
   * Stream printable thermal sticker PDF label for this Product Variant.
   */
  @Get(':id/label')
  getLabel(
    @Param('id') id: string,
    @Query() query: LabelQueryDto,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamVariantLabel(id, query, res);
  }
}
