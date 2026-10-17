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
} from './dto/purchase-order.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';

/**
 * PO_VIEW to read, PO_CREATE to make / edit / submit (Manager),
 * PO_APPROVE to approve / reject (Admin), PO_RECEIVE to receive goods (Staff).
 */
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
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.service.submit(id, req.user.sub);
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
