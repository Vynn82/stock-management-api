import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import { CustomerOrder } from '../customer-orders/entities/customer-order.entity';
import { CustomerOrderItem } from '../customer-orders/entities/customer-order-item.entity';
import { Customer } from '../customer-orders/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Request } from '../requests/entities/request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductVariant,
      Stock,
      StockAdjustment,
      CustomerOrder,
      CustomerOrderItem,
      Customer,
      User,
      Warehouse,
      Request,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
