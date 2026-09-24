import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';
import { MenusModule } from './menu/menu.module';
import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { ProductsModule } from './products/products.module';
import { ProductVariantsModule } from './product-variants/product-variants.module';
import { RequestsModule } from './requests/requests.module';
import { MailsModule } from './mails/mails.module';
import { StockModule } from './stock/stock.module';
import { StockAdjustmentsModule } from './stock-adjustments/stock-adjustments.module';
import { ReportsModule } from './reports/reports.module';
import { BarcodesModule } from './barcodes/barcodes.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        console.log('DATABASE CONFIG:', {
          host: configService.get<string>('DB_HOST'),
          port: configService.get<string>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
        });

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: Number(configService.get<string>('DB_PORT')),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),

          autoLoadEntities: true,
          synchronize: false,
          ssl: false,
        };
      },
    }),
    TypeOrmModule.forFeature([User]),

    UsersModule,

    RolesModule,

    PermissionsModule,

    SessionsModule,

    AuthModule,

    MenusModule,

    CategoriesModule,

    BrandsModule,

    SuppliersModule,

    WarehousesModule,

    ProductsModule,

    ProductVariantsModule,

    RequestsModule,

    MailsModule,

    StockModule,

    StockAdjustmentsModule,

    ReportsModule,

    BarcodesModule,
  ],
})
export class AppModule {}
