import {
  BadRequestException,
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
import { PaginationDto } from '../common/pagination';
import { ProductFilterDto } from './dto/product-filter.dto';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { imageUploadOptions } from '../common/cloudinary/cloudinary-storage';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsExcelService: ProductsExcelService,
  ) {}

  /**
   * Direct product creation for ADMIN and SUPER_ADMIN (no approvers required).
   */
  @Post()
  @RequirePermission('PRODUCT_CREATE')
  @UseInterceptors(
    AnyFilesInterceptor(imageUploadOptions),
  )
  async create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    const parseField = (field: any) => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    const product =
      parseField(body.product) ?? (body.productCode ? body : undefined);
    const variants = parseField(body.variants);
    const stock = parseField(body.stock);

    const dto = {
      product,
      variants,
      stock,
      remark: body.remark ?? null,
    };

    let productImageUrl: string | undefined;
    const variantImageUrls: Record<string, string> = {};

    for (const file of files ?? []) {
      if (file.fieldname === 'image') {
        productImageUrl = file.path;
        continue;
      }

      const match = file.fieldname.match(/^variantImage\[(.+)\]$/);
      if (match) {
        variantImageUrls[match[1]] = file.path;
      }
    }

    return this.productsService.createDirect(
      dto,
      req.user.sub,
      productImageUrl,
      variantImageUrls,
    );
  }

  @RequirePermission('PRODUCT_VIEW')
  @Get()
  async findAll(@Query() query: ProductFilterDto) {
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
      'Content-Length': file.length,
    });

    res.send(file);
  }

  /**
   * Export existing active products to an Excel file with dynamic filtering.
   * Supports filtering by date range (startDate/endDate), brand, category, and search.
   */
  @RequirePermission('PRODUCT_VIEW')
  @Get('export')
  async exportExcel(@Query() query: ProductFilterDto, @Res() res: Response) {
    const products = await this.productsService.exportAll(query);
    const file = this.productsExcelService.exportExcel(products);

    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="products_export_${dateStr}.xlsx"`,
      'Content-Length': file.length,
    });

    res.send(file);
  }

  /**
   * Import products directly from Excel (PRODUCT_IMPORT: Admin, Manager,
   * Super Admin). Separate from PRODUCT_CREATE so that giving a role the
   * import does not also switch its Add Product form from "send a request"
   * to "save directly".
   */
  @Post('import/preview')
  @RequirePermission('PRODUCT_IMPORT')
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    // Never throws for problems in the file: they come back as a list so the
    // review screen can show every one of them.
    try {
      const batchItems = this.productsExcelService.importExcel(file);
      return await this.productsService.previewManyDirect(batchItems);
    } catch (e) {
      if (e instanceof BadRequestException) {
        const body = e.getResponse() as any;
        const message =
          typeof body === 'string' ? body : String(body?.message ?? e.message);
        const errors: string[] = Array.isArray(body?.errors)
          ? body.errors.map(String)
          : [message];
        return { ok: false, message, errors };
      }
      throw e;
    }
  }

  @Post('import')
  @RequirePermission('PRODUCT_IMPORT')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    const batchItems = this.productsExcelService.importExcel(file);
    return this.productsService.createManyDirect(batchItems, req.user.sub);
  }

  /**
   * Scanner lookup: exact match on product/variant code, SKU or barcode.
   * Must stay above `:id` so "by-code" is not treated as an id.
   */
  @RequirePermission('PRODUCT_VIEW')
  @Get('by-code/:code')
  async findByCode(@Param('code') code: string) {
    return this.productsService.findByCode(code);
  }

  @RequirePermission('PRODUCT_VIEW')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  /**
   * Change the photo of an existing product (multipart field "image").
   * Own permission (PRODUCT_IMAGE: Admin, Manager) so Manager can fix photos
   * without PRODUCT_UPDATE (which also (de)activates products).
   */
  @RequirePermission('PRODUCT_IMAGE')
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  async updateImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.path) {
      throw new BadRequestException('Image file is required (field "image")');
    }
    return this.productsService.updateImage(id, file.path);
  }

  @RequirePermission('PRODUCT_DELETE')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @RequirePermission('PRODUCT_UPDATE')
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }

  @RequirePermission('PRODUCT_UPDATE')
  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    return this.productsService.activate(id);
  }
}
