import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TelegramService } from './telegram.service';
import { SalesReportPdfService } from './pdf/sales-report-pdf.service';

import { Request } from '../requests/entities/request.entity';
import { RequestItem } from '../requests/entities/request-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Request,
      RequestItem,
      Product,
      ProductVariant,
      Stock,
      StockAdjustment,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, TelegramService, SalesReportPdfService],
  exports: [ReportsService, TelegramService, SalesReportPdfService],
})
export class ReportsModule {}
