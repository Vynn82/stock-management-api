import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  ReceivePurchaseOrderDto,
  RejectPurchaseOrderDto,
  SubmitPurchaseOrderDto,
} from './dto/purchase-order.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';

/** PO_VIEW to read, PO_CREATE to make / edit / submit (Manager, Admin), PO_APPROVE to approve / reject (Admin), PO_RECEIVE to receive goods (Staff). */
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  /** Excel template for filling a purchase order's products. */
  @Public()
  @Get('import/template')
  async template(@Res() res: Response) {
    const file = await this.service.templateFile();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="purchase_order_products_template.xlsx"',
      'Content-Length': file.length,
    });
    res.send(file);
  }

  /** Admins / Super Admins a Manager can send an order to for approval. */
  @RequirePermission('PO_CREATE')
  @Get('approvers')
  approvers(@Req() req: authenticatedUserInterface.AuthenticatedRequest) {
    return this.service.approvers(req.user.sub);
  }

  /**
   * Products at or below their minimum stock (out of stock first), with what
   * is already on order and a suggested quantity. Optional ?warehouseCode=
   * counts the stock of that warehouse only.
   */
  @RequirePermission('PO_CREATE')
  @Get('reorder')
  reorder(@Query('warehouseCode') warehouseCode?: string) {
    return this.service.reorderList(warehouseCode);
  }

  /**
   * How full a warehouse gets if ?quantity= more units are ordered
   * (?excludeId= leaves out the order being edited).
   */
  @RequirePermission('PO_CREATE')
  @Get('warehouse-check')
  warehouseCheck(
    @Query('warehouseCode') warehouseCode: string,
    @Query('quantity') quantity?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.service.capacityPreview(
      warehouseCode ?? '',
      Number(quantity ?? 0),
      excludeId || undefined,
    );
  }

  /** Which suppliers a product was bought from, at what price and how fast. */
  @RequirePermission('PO_CREATE')
  @Get('supplier-history/:productId')
  supplierHistory(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.service.supplierHistory(productId);
  }

  /** Products really bought from one supplier (by its code). */
  @RequirePermission('PO_VIEW')
  @Get('supplier-products/:supplierCode')
  supplierProducts(@Param('supplierCode') supplierCode: string) {
    return this.service.supplierProducts(supplierCode);
  }

  /** Checks an Excel / CSV file row by row. Saves nothing. */
  @RequirePermission('PO_CREATE')
  @UseInterceptors(FileInterceptor('file'))
  @Post('import')
  importPreview(@UploadedFile() file: Express.Multer.File) {
    return this.service.previewImport(file);
  }

  @RequirePermission('PO_CREATE')
  @Post()
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.service.create(dto, req.user.sub);
  }

  @RequirePermission('PO_VIEW')
  @Get()
  findAll(@Query() query: PurchaseOrderQueryDto) {
    return this.service.findAll(query);
  }

  @RequirePermission('PO_VIEW')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /** Received new products, as an Add Product import file. */
  @RequirePermission('PO_VIEW')
  @Get(':id/export-products')
  async exportProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { file, name } = await this.service.pendingProductsFile(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': file.length,
    });
    res.send(file);
  }

  /** The manager added the received new products to the catalogue. */
  @RequirePermission('PO_CREATE')
  @Post(':id/catalog-added')
  catalogAdded(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.markCatalogAdded(id);
  }

  @RequirePermission('PO_CREATE')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, req.user.sub);
  }

  @RequirePermission('PO_CREATE')
  @Post(':id/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitPurchaseOrderDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.service.submit(id, req.user.sub, dto?.approverId);
  }

  @RequirePermission('PO_APPROVE')
  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.service.approve(id, req.user.sub);
  }

  @RequirePermission('PO_APPROVE')
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPurchaseOrderDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.service.reject(id, req.user.sub, dto.reason);
  }

  /** The rest of the order is not coming: close it. */
  @RequirePermission('PO_RECEIVE')
  @Post(':id/close')
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(id);
  }

  @RequirePermission('PO_RECEIVE')
  @Post(':id/receive')
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.service.receive(id, dto, req.user.sub);
  }
}
