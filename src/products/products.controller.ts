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
import { PaginationDto } from '../common/pagination';
import { ProductFilterDto } from './dto/product-filter.dto';
import { RequireRoles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { productStorage } from '../common/cloudinary/cloudinary-storage';

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
  @RequireRoles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: productStorage,
    }),
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
   * Import products directly from Excel (Admin & Super Admin only).
   */
  @Post('import')
  @RequireRoles('ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    const batchItems = this.productsExcelService.importExcel(file);
    return this.productsService.createManyDirect(batchItems, req.user.sub);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    return this.productsService.activate(id);
  }
}
