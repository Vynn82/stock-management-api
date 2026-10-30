import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Customer } from './entities/customer.entity';
import { CustomerTelegramAccount } from './entities/customer-telegram-account.entity';
import { CustomerOrder } from './entities/customer-order.entity';
import { CustomerOrderItem } from './entities/customer-order-item.entity';
import { CustomerOrderMessage } from './entities/customer-order-message.entity';
import { CustomerOrderPayment } from './entities/customer-order-payment.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { MailsModule } from '../mails/mails.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

import { CustomerOrdersService } from './customer-orders.service';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerAuthController } from './customer-auth.controller';
import { TelegramAuthService } from './telegram/telegram-auth.service';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { TelegramWebhookController } from './telegram/telegram-webhook.controller';
import { CustomerJwtGuard } from './guards/customer-jwt.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      CustomerTelegramAccount,
      CustomerOrder,
      CustomerOrderItem,
      CustomerOrderMessage,
      CustomerOrderPayment,
      Product,
      ProductVariant,
      Stock,
      Warehouse,
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
    MailsModule,
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [
    CustomerOrdersController,
    CustomerAuthController,
    TelegramWebhookController,
  ],
  providers: [
    CustomerOrdersService,
    TelegramAuthService,
    TelegramBotService,
    CustomerJwtGuard,
  ],
  exports: [
    CustomerOrdersService,
    TelegramAuthService,
    TelegramBotService,
    CustomerJwtGuard,
  ],
})
export class CustomerOrdersModule {}
