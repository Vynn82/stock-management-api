import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoyaltyTier } from './entities/loyalty-tier.entity';
import { LoyaltyConfig } from './entities/loyalty-config.entity';
import { Customer } from '../customer-orders/entities/customer.entity';
import { CustomerOrder } from '../customer-orders/entities/customer-order.entity';
import { CustomerOrderItem } from '../customer-orders/entities/customer-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Category } from '../categories/entities/category.entity';

import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { CustomerLoyaltyController } from './customer-loyalty.controller';
import { CustomerOrdersModule } from '../customer-orders/customer-orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoyaltyTier,
      LoyaltyConfig,
      Customer,
      CustomerOrder,
      CustomerOrderItem,
      Product,
      ProductVariant,
      Category,
    ]),
    forwardRef(() => CustomerOrdersModule),
  ],
  controllers: [LoyaltyController, CustomerLoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}

