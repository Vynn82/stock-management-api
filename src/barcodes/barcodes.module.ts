import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BarcodesService } from './barcodes.service';
import { BarcodesController } from './barcodes.controller';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductVariant, Stock])],
  controllers: [BarcodesController],
  providers: [BarcodesService],
  exports: [BarcodesService],
})
export class BarcodesModule {}
