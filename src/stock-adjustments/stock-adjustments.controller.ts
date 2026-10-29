import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { StockAdjustmentsService } from './stock-adjustments.service';
import {
  CreateStockAdjustmentDto,
  CreateStockAdjustmentItemDto,
} from './dto/create-stock-adjustment.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { StockAdjustmentQueryDto } from './dto/stock-adjustment-query.dto';
import { Public } from '../auth/decorators/public.decorator';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('stock-adjustments')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  // =====================================================
  // DIRECT STOCK ADJUSTMENT (ADMIN & SUPER_ADMIN)
  // =====================================================

  @RequirePermission('STOCK_ADJUST')
  @Post()
  async create(
    @Body() dto: CreateStockAdjustmentDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    let items: CreateStockAdjustmentItemDto[] = [];

    if (
      dto.adjustments &&
      Array.isArray(dto.adjustments) &&
      dto.adjustments.length > 0
    ) {
      items = dto.adjustments;
    } else if (dto.productCode && dto.warehouseCode) {
      items = [
        {
          productCode: dto.productCode,
          variantCode: dto.variantCode,
          warehouseCode: dto.warehouseCode,
          adjustmentType: dto.adjustmentType,
          quantity: dto.quantity as number,
          reason: dto.reason as string,
          location: dto.location,
        },
      ];
    } else {
      throw new BadRequestException(
        'Provide an "adjustments" array or single adjustment fields (productCode, warehouseCode, quantity, reason)',
      );
    }

    return this.stockAdjustmentsService.adjustDirect(items, req.user.sub);
  }

  // =====================================================
  // DIRECT STOCK TRANSFER (SUPER_ADMIN, ADMIN & MANAGER)
  // =====================================================

  @RequirePermission('STOCK_TRANSFER')
  @Post('transfer')
  transfer(
    @Body() dto: CreateStockTransferDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.stockAdjustmentsService.transferDirect(
      dto.transfers,
      req.user.sub,
    );
  }

  // =====================================================
  // DIRECT EXCEL IMPORT (ADMIN & SUPER_ADMIN)
  // =====================================================

  @RequirePermission('STOCK_ADJUST')
  @UseInterceptors(FileInterceptor('file'))
  @Post('import')
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.stockAdjustmentsService.importExcel(file, req.user.sub);
  }

  // =====================================================
  // EXCEL TEMPLATE DOWNLOAD
  // =====================================================

  @Public()
  @Get('import/template')
  downloadTemplate(@Res() res: Response) {
    const file = this.stockAdjustmentsService.generateTemplate();

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="stock_adjustment_direct_template.xlsx"',
      'Content-Length': file.length,
    });

    res.send(file);
  }

  // =====================================================
  // AUDIT LOG LIST & DETAILS
  // =====================================================

  /**
   * One timeline of every stock movement: Stock In, Stock Out, Transfer and
   * Adjustment. Filters: ?kind=IN|OUT|TRANSFER|ADJUSTMENT, ?productId=,
   * ?page=, ?limit=. Must stay above `:id`.
   */
  @RequirePermission('ADJUSTMENT_VIEW')
  @Get('history')
  history(
    @Query('kind') kind?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockAdjustmentsService.history({
      kind,
      productId,
      page: Number(page),
      limit: Number(limit),
    });
  }

  /**
   * The same timeline, but only the caller's own movements (what they did
   * and the requests they made). For staff who cannot see everyone's history.
   */
  @RequirePermission('REQUEST_CREATE')
  @Get('history/mine')
  historyMine(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Query('kind') kind?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockAdjustmentsService.history({
      kind,
      productId,
      userId: req.user.sub,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @RequirePermission('ADJUSTMENT_VIEW')
  @Get()
  findAll(@Query() query: StockAdjustmentQueryDto) {
    return this.stockAdjustmentsService.findAll(query);
  }

  @RequirePermission('ADJUSTMENT_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockAdjustmentsService.findOne(id);
  }
}
