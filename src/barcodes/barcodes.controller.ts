import {
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BarcodesService } from './barcodes.service';
import {
  GenerateBarcodeQueryDto,
  GenerateQrQueryDto,
  LabelQueryDto,
} from './dto/barcode-query.dto';

@Controller('barcodes')
export class BarcodesController {
  constructor(private readonly barcodesService: BarcodesService) {}

  /**
   * Scanner / Lookup endpoint: Resolves a scanned Barcode, SKU, or Product Code.
   */
  @Get('lookup/:code')
  lookup(@Param('code') code: string) {
    return this.barcodesService.lookupByBarcode(code);
  }

  /**
   * Stream 1D Barcode image for a specific Product.
   */
  @Get('products/:id/barcode')
  getProductBarcode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateBarcodeQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamProductBarcode(id, query, res);
  }

  /**
   * Stream 2D QR Code image for a specific Product.
   */
  @Get('products/:id/qrcode')
  getProductQrCode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateQrQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamProductQr(id, query, res);
  }

  /**
   * Stream printable thermal sticker PDF label for a Product.
   */
  @Get('products/:id/label')
  getProductLabel(
    @Param('id') id: string,
    @Query() query: LabelQueryDto,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamProductLabel(id, query, res);
  }

  /**
   * Stream 1D Barcode image for a specific Product Variant.
   */
  @Get('variants/:id/barcode')
  getVariantBarcode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateBarcodeQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamVariantBarcode(id, query, res);
  }

  /**
   * Stream 2D QR Code image for a specific Product Variant.
   */
  @Get('variants/:id/qrcode')
  getVariantQrCode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateQrQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamVariantQr(id, query, res);
  }

  /**
   * Stream printable thermal sticker PDF label for a Product Variant.
   */
  @Get('variants/:id/label')
  getVariantLabel(
    @Param('id') id: string,
    @Query() query: LabelQueryDto,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamVariantLabel(id, query, res);
  }
}
