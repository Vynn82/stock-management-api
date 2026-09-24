import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';

import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { BarcodesService } from '../barcodes/barcodes.service';
import {
  GenerateBarcodeQueryDto,
  GenerateQrQueryDto,
  LabelQueryDto,
} from '../barcodes/dto/barcode-query.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { RequireRoles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { productStorage } from '../common/cloudinary/cloudinary-storage';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsExcelService: ProductsExcelService,
    private readonly barcodesService: BarcodesService,
  ) {}

  /**
   * Direct product creation for ADMIN and SUPER_ADMIN (no approvers required).
   */
  @Post()
  @RequireRoles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: productStorage,
    }),
  )
  create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.productsService.createFromMultipart(body, files, req.user.sub);
  }

  @Get()
  findAll(@Query() query: ProductFilterDto) {
    return this.productsService.findAll(query);
  }

  /**
   * Download Excel template for direct product creation / import.
   */
  @Public()
  @Get('import/template')
  downloadTemplate(@Res() res: Response) {
    const file = this.productsExcelService.generateTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="products_direct_import_template.xlsx"',
      'Content-Length': file.length.toString(),
    });

    return res.send(file);
  }

  /**
   * Export existing active products to an Excel file with dynamic filtering.
   * Supports filtering by date range (startDate/endDate), brand, category, and search.
   */
  @Get('export')
  async exportExcel(@Query() query: ProductFilterDto, @Res() res: Response) {
    const products = await this.productsService.exportAll(query);
    const file = this.productsExcelService.exportExcel(products);

    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="products_export_${dateStr}.xlsx"`,
      'Content-Length': file.length.toString(),
    });

    return res.send(file);
  }

  /**
   * Import products directly from Excel (Admin & Super Admin only).
   */
  @Post('import')
  @RequireRoles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    const batchItems = this.productsExcelService.importExcel(file);
    return this.productsService.createManyDirect(batchItems, req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.productsService.activate(id);
  }

  /**
   * Fast Barcode / SKU / QR Scanner Lookup.
   */
  @Get('lookup/barcode/:code')
  lookupByBarcode(@Param('code') code: string) {
    return this.barcodesService.lookupByBarcode(code);
  }

  /**
   * Stream 1D Barcode image (PNG or SVG) for this Product.
   */
  @Get(':id/barcode')
  getBarcode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateBarcodeQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamProductBarcode(id, query, res);
  }

  /**
   * Stream 2D QR Code image (PNG or SVG) for this Product.
   */
  @Get(':id/qrcode')
  getQrCode(
    @Param('id') id: string,
    @Query() query: Partial<GenerateQrQueryDto>,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamProductQr(id, query, res);
  }

  /**
   * Stream printable thermal sticker PDF label for this Product.
   */
  @Get(':id/label')
  getLabel(
    @Param('id') id: string,
    @Query() query: LabelQueryDto,
    @Res() res: Response,
  ) {
    return this.barcodesService.streamProductLabel(id, query, res);
  }
}
