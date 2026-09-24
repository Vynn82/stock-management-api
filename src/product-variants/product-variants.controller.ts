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

@Controller('product-variants')
export class ProductVariantsController {
  constructor(
    private readonly variantsService: ProductVariantsService,
    private readonly barcodesService: BarcodesService,
  ) {}

  @Post()
  create(@Body() dto: CreateProductVariantDto) {
    return this.variantsService.create(dto);
  }

  @Get()
  findAll(
    @Query('productId') productId?: string,
    @Query() query?: PaginationDto,
  ) {
    return this.variantsService.findAll(productId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.variantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductVariantDto) {
    return this.variantsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.variantsService.remove(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.variantsService.deactivate(id);
  }

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
