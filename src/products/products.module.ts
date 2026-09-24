import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from './entities/product.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';

import { BarcodesModule } from '../barcodes/barcodes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Brand,
      Supplier,
      ProductVariant,
      Stock,
      Warehouse,
    ]),
    BarcodesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsExcelService],
  exports: [ProductsService, ProductsExcelService],
})
export class ProductsModule {}
