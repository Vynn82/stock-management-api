import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
import { CustomerJwtGuard } from '../customer-orders/guards/customer-jwt.guard';

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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '7d',
        },
      }),
    }),
    forwardRef(() => CustomerOrdersModule),
  ],
  controllers: [LoyaltyController, CustomerLoyaltyController],
  providers: [LoyaltyService, CustomerJwtGuard],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
