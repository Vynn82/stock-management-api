import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductVariant } from './entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';
import { BarcodesService } from '../barcodes/barcodes.service';

import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    private readonly barcodesService: BarcodesService,
  ) {}

  // =====================================================
  // CREATE
  // =====================================================

  async create(dto: CreateProductVariantDto) {
    const product = await this.productRepository.findOne({
      where: {
        id: dto.productId,
        isActive: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Active product not found');
    }

    if (!product.hasVariants) {
      throw new ConflictException('This product does not support variants');
    }

    const existingSku = await this.variantRepository.findOne({
      where: {
        sku: dto.sku.toUpperCase(),
      },
    });

    if (existingSku) {
      throw new ConflictException('Variant SKU already exists');
    }

    const code = dto.code.toUpperCase();

    const existingCode = await this.variantRepository.findOne({
      where: {
        code,
      },
    });

    if (existingCode) {
      throw new ConflictException('Variant code already exists');
    }

    let barcode = dto.barcode;
    if (!barcode || (typeof barcode === 'string' && !barcode.trim())) {
      barcode = await this.barcodesService.generateUniqueBarcode();
    } else {
      const existingBarcode = await this.variantRepository.findOne({
        where: {
          barcode,
        },
      });

      if (existingBarcode) {
        throw new ConflictException('Variant barcode already exists');
      }
    }

    const variant = this.variantRepository.create({
      ...dto,
      code,
      sku: dto.sku.toUpperCase(),
      barcode: barcode ?? null,
      attributes: dto.attributes ?? null,
      costPrice: dto.costPrice ?? null,
      sellingPrice: dto.sellingPrice ?? null,
      isActive: true,
    });

    return this.variantRepository.save(variant);
  }

  // =====================================================
  // FIND ALL
  // =====================================================

  async findAll(productId?: string, paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const query = this.variantRepository
      .createQueryBuilder('variant')
      .leftJoinAndSelect('variant.product', 'product')
      .where('variant.is_active = :isActive', {
        isActive: true,
      });

    if (productId) {
      query.andWhere('variant.product_id = :productId', {
        productId,
      });
    }

    if (search) {
      query.andWhere(
        '(variant.name ILIKE :search OR variant.code ILIKE :search OR variant.sku ILIKE :search OR variant.barcode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('variant.name', 'ASC');
    query.skip(skip).take(limit);

    const [variants, total] = await query.getManyAndCount();

    return createPaginatedResult(variants, total, paginationDto);
  }

  // =====================================================
  // FIND ONE
  // =====================================================

  async findOne(id: string) {
    const variant = await this.variantRepository.findOne({
      where: {
        id,
      },
      relations: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    return variant;
  }

  // =====================================================
  // UPDATE
  // =====================================================

  async update(id: string, dto: UpdateProductVariantDto) {
    const variant = await this.findOne(id);

    if (dto.productId) {
      const product = await this.productRepository.findOne({
        where: {
          id: dto.productId,
          isActive: true,
        },
      });

      if (!product) {
        throw new NotFoundException('Active product not found');
      }

      if (!product.hasVariants) {
        throw new ConflictException('This product does not support variants');
      }

      variant.productId = dto.productId;
    }

    if (dto.code) {
      const code = dto.code.toUpperCase();

      const existing = await this.variantRepository.findOne({
        where: {
          code,
          productId: variant.productId,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Variant code already exists for this product',
        );
      }

      variant.code = code;
    }

    if (dto.sku) {
      const sku = dto.sku.toUpperCase();

      const existing = await this.variantRepository.findOne({
        where: {
          sku,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Variant SKU already exists');
      }

      variant.sku = sku;
    }

    if (dto.barcode !== undefined) {
      if (dto.barcode) {
        const existing = await this.variantRepository.findOne({
          where: {
            barcode: dto.barcode,
          },
        });

        if (existing && existing.id !== id) {
          throw new ConflictException('Variant barcode already exists');
        }
      }

      variant.barcode = dto.barcode ?? null;
    }

    if (dto.name !== undefined) {
      variant.name = dto.name.trim();
    }

    if (dto.attributes !== undefined) {
      variant.attributes = dto.attributes;
    }

    if (dto.costPrice !== undefined) {
      variant.costPrice = dto.costPrice;
    }

    if (dto.sellingPrice !== undefined) {
      variant.sellingPrice = dto.sellingPrice;
    }

    return this.variantRepository.save(variant);
  }

  // =====================================================
  // DELETE
  // =====================================================

  async remove(id: string) {
    const variant = await this.findOne(id);

    try {
      await this.variantRepository.remove(variant);
      return {
        message: 'Product variant deleted successfully',
      };
    } catch (error) {
      if (error?.code === '23503') {
        throw new BadRequestException(
          'Cannot delete product variant because it is referenced by transactions or stock history. Consider deactivating it instead.',
        );
      }
      throw error;
    }
  }

  // =====================================================
  // DEACTIVATE
  // =====================================================

  async deactivate(id: string) {
    const variant = await this.findOne(id);

    if (!variant.isActive) {
      return {
        message: 'Product variant is already inactive',
      };
    }

    variant.isActive = false;

    await this.variantRepository.save(variant);

    return {
      message: 'Product variant deactivated successfully',
    };
  }

  // =====================================================
  // ACTIVATE
  // =====================================================

  async activate(id: string) {
    const variant = await this.findOne(id);

    if (variant.isActive) {
      return {
        message: 'Product variant is already active',
      };
    }

    variant.isActive = true;

    await this.variantRepository.save(variant);

    return {
      message: 'Product variant activated successfully',
    };
  }
}
