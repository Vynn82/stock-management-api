import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { ProductDirectCreateBatchItem } from './products-excel.service';
import { ProductFilterDto } from './dto/product-filter.dto';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(filterDto?: ProductFilterDto) {
    const { limit, skip } = getPaginationOptions(filterDto);

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('variants.stocks', 'variantStocks')
      .leftJoinAndSelect('variantStocks.warehouse', 'variantWarehouse')
      .leftJoinAndSelect('product.stocks', 'stocks')
      .leftJoinAndSelect('stocks.variant', 'stockVariant')
      .leftJoinAndSelect('stocks.warehouse', 'warehouse')
      .where('product.isActive = :isActive', { isActive: true });

    this.applyProductFilters(queryBuilder, filterDto);

    queryBuilder.orderBy('product.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    const formattedData = products.map((product) => ({
      ...product,
      costPrice: Number(product.costPrice),
      sellingPrice: Number(product.sellingPrice),
      minimumStock: Number(product.minimumStock),
      maximumStock:
        product.maximumStock !== null ? Number(product.maximumStock) : null,

      variants: product.variants?.map((variant) => ({
        ...variant,
        costPrice:
          variant.costPrice !== null ? Number(variant.costPrice) : null,
        sellingPrice:
          variant.sellingPrice !== null ? Number(variant.sellingPrice) : null,

        stocks: variant.stocks?.map((stock) => ({
          ...stock,
          quantity: Number(stock.quantity),
        })),
      })),

      stocks: product.stocks?.map((stock) => ({
        ...stock,
        quantity: Number(stock.quantity),
      })),
    }));

    return createPaginatedResult(formattedData, total, filterDto);
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: {
        id,
      },
      relations: {
        category: true,
        brand: true,
        supplier: true,
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    try {
      await this.productRepository.remove(product);
      return {
        message: 'Product deleted successfully',
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23503'
      ) {
        throw new BadRequestException(
          'Cannot delete product because it is referenced by transactions or stock history. Consider deactivating it instead.',
        );
      }
      throw error;
    }
  }

  async deactivate(id: string) {
    const product = await this.findOne(id);

    if (!product.isActive) {
      return {
        message: 'Product is already inactive',
      };
    }

    product.isActive = false;
    await this.productRepository.save(product);

    return {
      message: 'Product deactivated successfully',
    };
  }

  async activate(id: string) {
    const product = await this.findOne(id);

    if (product.isActive) {
      return {
        message: 'Product is already active',
      };
    }

    product.isActive = true;
    await this.productRepository.save(product);

    return {
      message: 'Product activated successfully',
    };
  }

  async createDirect(
    dto: any,
    userId: string,
    productImageUrl?: string,
    variantImageUrls?: Record<string, string>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const product = await this.insertProductDirect(
        manager,
        dto,
        productImageUrl,
        variantImageUrls,
      );

      return {
        message: 'Product created successfully',
        product,
      };
    });
  }

  async createManyDirect(
    batchItems: ProductDirectCreateBatchItem[],
    userId?: string,
  ) {
    if (!batchItems || batchItems.length === 0) {
      throw new BadRequestException('No products to import');
    }

    return this.dataSource.transaction(async (manager) => {
      const createdProducts: any[] = [];

      for (const item of batchItems) {
        const product = await this.insertProductDirect(manager, item);
        createdProducts.push(product);
      }

      return {
        message: `Successfully imported ${createdProducts.length} product(s)`,
        importedCount: createdProducts.length,
        products: createdProducts,
      };
    });
  }

  async exportAll(filterDto?: ProductFilterDto) {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.supplier', 'supplier')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('variants.stocks', 'variantStocks')
      .leftJoinAndSelect('variantStocks.warehouse', 'variantWarehouse')
      .leftJoinAndSelect('product.stocks', 'stocks')
      .leftJoinAndSelect('stocks.variant', 'stockVariant')
      .leftJoinAndSelect('stocks.warehouse', 'warehouse')
      .where('product.isActive = :isActive', { isActive: true });

    this.applyProductFilters(queryBuilder, filterDto);

    queryBuilder.orderBy('product.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  private applyProductFilters(
    queryBuilder: SelectQueryBuilder<Product>,
    filterDto?: ProductFilterDto,
  ) {
    if (!filterDto) return;

    const search = filterDto.search?.trim();
    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.code ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const startDateStr = filterDto.startDate || filterDto.fromDate;
    if (startDateStr) {
      const start = new Date(startDateStr);
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        queryBuilder.andWhere('product.createdAt >= :start', { start });
      }
    }

    const endDateStr = filterDto.endDate || filterDto.toDate;
    if (endDateStr) {
      const end = new Date(endDateStr);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        queryBuilder.andWhere('product.createdAt <= :end', { end });
      }
    }

    const brandVal =
      filterDto.brand || filterDto.brandCode || filterDto.brandId;
    if (brandVal?.trim()) {
      queryBuilder.andWhere(
        '(brand.code ILIKE :brandVal OR brand.name ILIKE :brandVal OR brand.id::text = :brandValRaw)',
        { brandVal: `%${brandVal.trim()}%`, brandValRaw: brandVal.trim() },
      );
    }

    const catVal =
      filterDto.category || filterDto.categoryCode || filterDto.categoryId;
    if (catVal?.trim()) {
      queryBuilder.andWhere(
        '(category.code ILIKE :catVal OR category.name ILIKE :catVal OR category.id::text = :catValRaw)',
        { catVal: `%${catVal.trim()}%`, catValRaw: catVal.trim() },
      );
    }
  }

  private async insertProductDirect(
    manager: EntityManager,
    dto: any,
    productImageUrl?: string,
    variantImageUrls?: Record<string, string>,
  ) {
    const productData = dto?.product;
    if (!productData) {
      throw new BadRequestException('Product payload is required');
    }

    // 1. Resolve & normalize product fields
    const code = productData.productCode ?? productData.code;
    const name = productData.productName ?? productData.name;
    const categoryCode = productData.categoryCode ?? productData.category;
    const brandCode = productData.brandCode ?? productData.brand ?? null;
    const supplierCode =
      productData.supplierCode ?? productData.supplier ?? null;
    const hasVariants =
      productData.hasVariants === true || productData.hasVariants === 'true';
    const unit = productData.unit;
    const sku = productData.productSku ?? productData.sku;
    const barcode = productData.productBarcode ?? productData.barcode ?? null;
    const costPrice = Number(
      productData.productCostPrice ?? productData.costPrice ?? 0,
    );
    const sellingPrice = Number(
      productData.productSellingPrice ?? productData.sellingPrice ?? 0,
    );
    const minimumStock = Number(productData.minimumStock ?? 0);
    const maximumStock =
      productData.maximumStock !== undefined &&
      productData.maximumStock !== null &&
      productData.maximumStock !== ''
        ? Number(productData.maximumStock)
        : null;
    const description = productData.description ?? null;

    // Validation
    if (!code) {
      throw new BadRequestException('Product code is required');
    }
    if (!name) {
      throw new BadRequestException('Product name is required');
    }
    if (!categoryCode) {
      throw new BadRequestException('Category code is required');
    }
    if (!unit) {
      throw new BadRequestException('Unit is required');
    }
    if (!sku) {
      throw new BadRequestException('Product SKU is required');
    }

    // Check unique constraints on Product
    const existingProductByCode = await manager.findOne(Product, {
      where: { code },
    });
    if (existingProductByCode) {
      throw new BadRequestException(
        `Product with code "${code}" already exists`,
      );
    }

    const existingProductBySku = await manager.findOne(Product, {
      where: { sku },
    });
    if (existingProductBySku) {
      throw new BadRequestException(`Product with SKU "${sku}" already exists`);
    }

    if (barcode) {
      const existingProductByBarcode = await manager.findOne(Product, {
        where: { barcode },
      });
      if (existingProductByBarcode) {
        throw new BadRequestException(
          `Product with barcode "${barcode}" already exists`,
        );
      }
    }

    // Find Category
    const category = await manager.findOne(Category, {
      where: { code: categoryCode, isActive: true },
    });
    if (!category) {
      throw new BadRequestException(
        `Category "${categoryCode}" not found or inactive`,
      );
    }

    // Find Brand if provided
    let brand: Brand | null = null;
    if (brandCode) {
      brand = await manager.findOne(Brand, {
        where: { code: brandCode, isActive: true },
      });
      if (!brand) {
        throw new BadRequestException(
          `Brand "${brandCode}" not found or inactive`,
        );
      }
    }

    // Find Supplier if provided
    let supplier: Supplier | null = null;
    if (supplierCode) {
      supplier = await manager.findOne(Supplier, {
        where: { code: supplierCode, isActive: true },
      });
      if (!supplier) {
        throw new BadRequestException(
          `Supplier "${supplierCode}" not found or inactive`,
        );
      }
    }

    // 2. Create and persist Product directly
    const product = manager.create(Product, {
      code,
      name,
      image: productImageUrl ?? null,
      description,
      categoryId: category.id,
      brandId: brand?.id ?? null,
      supplierId: supplier?.id ?? null,
      hasVariants,
      unit,
      sku,
      barcode,
      costPrice,
      sellingPrice,
      minimumStock,
      maximumStock,
      isActive: true,
    });

    const savedProduct = await manager.save(Product, product);

    // 3. Process Product Variants if hasVariants is true
    const variantDtos = Array.isArray(dto.variants) ? dto.variants : [];
    if (hasVariants && variantDtos.length === 0) {
      throw new BadRequestException(
        `At least one variant is required for product "${code}" when hasVariants is true`,
      );
    }

    const savedVariants: ProductVariant[] = [];
    for (const v of variantDtos) {
      const vCode = v.variantCode ?? v.code;
      const vName = v.variantName ?? v.name;
      const vSku = v.variantSku ?? v.sku;
      const vBarcode = v.variantBarcode ?? v.barcode ?? null;
      const vAttributes = v.variantAttributes ?? v.attributes ?? null;
      const vCostPrice =
        v.variantCostPrice !== undefined &&
        v.variantCostPrice !== null &&
        v.variantCostPrice !== ''
          ? Number(v.variantCostPrice)
          : null;
      const vSellingPrice =
        v.variantSellingPrice !== undefined &&
        v.variantSellingPrice !== null &&
        v.variantSellingPrice !== ''
          ? Number(v.variantSellingPrice)
          : null;
      const vImage = variantImageUrls?.[vCode] ?? v.image ?? null;

      if (!vCode) {
        throw new BadRequestException(
          `Variant code is required for variants of product "${code}"`,
        );
      }
      if (!vSku) {
        throw new BadRequestException(
          `Variant SKU is required for variant "${vCode}"`,
        );
      }

      const existingVariantSku = await manager.findOne(ProductVariant, {
        where: { sku: vSku },
      });
      if (existingVariantSku) {
        throw new BadRequestException(
          `Variant with SKU "${vSku}" already exists`,
        );
      }

      if (vBarcode) {
        const existingVariantBarcode = await manager.findOne(ProductVariant, {
          where: { barcode: vBarcode },
        });
        if (existingVariantBarcode) {
          throw new BadRequestException(
            `Variant with barcode "${vBarcode}" already exists`,
          );
        }
      }

      const variant = manager.create(ProductVariant, {
        productId: savedProduct.id,
        code: vCode,
        name: vName || savedProduct.name,
        sku: vSku,
        barcode: vBarcode,
        attributes: vAttributes,
        image: vImage,
        costPrice: vCostPrice,
        sellingPrice: vSellingPrice,
        isActive: true,
      });

      const savedVariant = await manager.save(ProductVariant, variant);
      savedVariants.push(savedVariant);
    }

    // 4. Process initial Stock entries if provided
    const stockDtos = Array.isArray(dto.stock) ? dto.stock : [];
    const savedStocks: Stock[] = [];

    for (const s of stockDtos) {
      const warehouseCode = s.warehouseCode;
      if (!warehouseCode) {
        throw new BadRequestException(
          `Warehouse code is required for stock entries of product "${code}"`,
        );
      }

      const warehouse = await manager.findOne(Warehouse, {
        where: { code: warehouseCode, isActive: true },
      });
      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse "${warehouseCode}" not found or inactive`,
        );
      }

      const quantity = Number(s.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Quantity must be a positive number for warehouse "${warehouseCode}"`,
        );
      }

      let variantId: string | null = null;
      const variantCode = s.variantCode;
      if (variantCode) {
        const matchedVariant = savedVariants.find(
          (v) => v.code === variantCode,
        );
        if (!matchedVariant) {
          throw new BadRequestException(
            `Variant "${variantCode}" not found in variants list for stock`,
          );
        }
        variantId = matchedVariant.id;
      } else if (hasVariants && savedVariants.length > 0) {
        throw new BadRequestException(
          `variantCode is required for stock entry when product "${code}" has variants`,
        );
      }

      const stock = manager.create(Stock, {
        productId: savedProduct.id,
        variantId,
        warehouseId: warehouse.id,
        quantity,
      });

      const savedStock = await manager.save(Stock, stock);
      savedStocks.push(savedStock);
    }

    // 5. Return formatted product
    return {
      ...savedProduct,
      costPrice: Number(savedProduct.costPrice),
      sellingPrice: Number(savedProduct.sellingPrice),
      minimumStock: Number(savedProduct.minimumStock),
      maximumStock:
        savedProduct.maximumStock !== null
          ? Number(savedProduct.maximumStock)
          : null,
      category: {
        id: category.id,
        code: category.code,
        name: category.name,
      },
      brand: brand
        ? {
            id: brand.id,
            code: brand.code,
            name: brand.name,
          }
        : null,
      supplier: supplier
        ? {
            id: supplier.id,
            code: supplier.code,
            name: supplier.name,
          }
        : null,
      variants: savedVariants.map((variant) => ({
        ...variant,
        costPrice:
          variant.costPrice !== null ? Number(variant.costPrice) : null,
        sellingPrice:
          variant.sellingPrice !== null ? Number(variant.sellingPrice) : null,
      })),
      stocks: savedStocks.map((stk) => ({
        ...stk,
        quantity: Number(stk.quantity),
      })),
    };
  }
}
