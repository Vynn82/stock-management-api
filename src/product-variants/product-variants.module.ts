import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductVariant } from './entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';

import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant, Product])],
  controllers: [ProductVariantsController],
  providers: [ProductVariantsService],
  exports: [TypeOrmModule],
})
export class ProductVariantsModule {}
