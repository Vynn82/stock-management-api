import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustment } from './entities/stock-adjustment.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockAdjustment,
      Stock,
      Product,
      ProductVariant,
      Warehouse,
      User,
    ]),
  ],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
  exports: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
