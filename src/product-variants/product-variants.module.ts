import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductVariant } from './entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';

import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';

import { BarcodesModule } from '../barcodes/barcodes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductVariant, Product]),
    BarcodesModule,
  ],
  controllers: [ProductVariantsController],
  providers: [ProductVariantsService],
  exports: [ProductVariantsService, TypeOrmModule],
})
export class ProductVariantsModule {}
