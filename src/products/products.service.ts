import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Not,
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
import { assertFits, loadWarehouse } from '../warehouses/warehouse-capacity';
import { ProductDirectCreateBatchItem } from './products-excel.service';
import { ProductFilterDto } from './dto/product-filter.dto';
import {
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';
import { deleteMultipleCloudinaryImages } from '../common/cloudinary/cloudinary.utils';

import { BarcodesService } from '../barcodes/barcodes.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly barcodesService: BarcodesService,
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

  async findByCode(rawCode: string) {
    const code = rawCode?.trim();
    if (!code) {
      throw new BadRequestException('Code is required');
    }
    const hit = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.variants', 'variant')
      .select(['product.id', 'variant.id'])
      .addSelect(
        `(LOWER(variant.code) = LOWER(:code) OR LOWER(variant.sku) = LOWER(:code) OR LOWER(variant.barcode) = LOWER(:code))`,
        'variant_match',
      )
      .where('product.isActive = :isActive', { isActive: true })
      .andWhere(
        `(LOWER(product.code) = LOWER(:code)
          OR LOWER(product.sku) = LOWER(:code)
          OR LOWER(product.barcode) = LOWER(:code)
          OR LOWER(variant.code) = LOWER(:code)
          OR LOWER(variant.sku) = LOWER(:code)
          OR LOWER(variant.barcode) = LOWER(:code))`,
        { code },
      )
      .orderBy('variant_match', 'DESC', 'NULLS LAST')
      .limit(1)
      .getRawOne<{
        product_id: string;
        variant_id: string | null;
        variant_match: boolean | null;
      }>();

    if (!hit) {
      throw new NotFoundException('No product found for this code');
    }

    // Step 2: load the full product the same way the list does.
    const product = await this.productRepository
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
      .where('product.id = :id', { id: hit.product_id })
      .getOne();

    if (!product) {
      throw new NotFoundException('No product found for this code');
    }

    return {
      ...this.formatProduct(product),
      matchedVariantId: hit.variant_match ? hit.variant_id : null,
    };
  }

  /** Next internal product code: PRD-0001, PRD-0002, ... (race-safe within the transaction). */
  private async generateProductCode(manager: EntityManager): Promise<string> {
    await manager.query('SELECT pg_advisory_xact_lock(7001)');
    const rows: Array<{ next: string }> = await manager.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) + 1 AS next
       FROM (
         SELECT code FROM products
         UNION ALL
         SELECT product_code AS code FROM request_items
       ) t
       WHERE code ~ '^PRD-[0-9]+$'`,
    );
    const next = Number(rows[0]?.next ?? 1);
    return `PRD-${String(next).padStart(4, '0')}`;
  }

  /** Builds a readable SKU like APL-IPHONE-15 and makes it unique with a numeric suffix. */
  private async generateUniqueSku(
    manager: EntityManager,
    brandCode: string | null,
    name: string,
  ): Promise<string> {
    const clean = (text: string) =>
      text
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const parts = [brandCode ? clean(brandCode).slice(0, 6) : '', clean(name).slice(0, 20)]
      .filter(Boolean);
    const base = parts.join('-') || 'ITEM';

    let candidate = base;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const inProduct = await manager.findOne(Product, {
        where: { sku: candidate },
      });
      const inVariant = await manager.findOne(ProductVariant, {
        where: { sku: candidate },
      });
      if (!inProduct && !inVariant) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  }

  private formatProduct(product: Product) {
    return {
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
    };
  }

  async findOne(id: string) {
    const product = await this.productRepository
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
      .where('product.id = :id', { id })
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.formatProduct(product);
  }

  /** Edits a product and (optionally) its existing variants. */
  async updateProduct(id: string, body: any) {
    const data = body ?? {};
    const has = (key: string) => data[key] !== undefined;
    const text = (value: unknown) =>
      value === null || value === undefined ? '' : String(value).trim();
    const money = (value: unknown, label: string) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException(`${label} must be a number of 0 or more`);
      }
      return n;
    };
    const optionalMoney = (value: unknown, label: string) =>
      value === null || value === undefined || value === ''
        ? null
        : money(value, label);

    await this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id },
        relations: { variants: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      if (has('name')) {
        const name = text(data.name);
        if (!name) throw new BadRequestException('Product name is required');
        if (name.length > 200) {
          throw new BadRequestException('Product name is too long (max 200)');
        }
        product.name = name;
      }
      if (has('description')) product.description = text(data.description) || null;
      if (has('unit')) {
        const unit = text(data.unit);
        if (!unit) throw new BadRequestException('Unit is required');
        product.unit = unit;
      }

      if (has('categoryCode')) {
        const category = await manager.findOne(Category, {
          where: { code: text(data.categoryCode), isActive: true },
        });
        if (!category) {
          throw new BadRequestException(
            `Category "${text(data.categoryCode)}" not found or inactive`,
          );
        }
        product.categoryId = category.id;
        product.category = category;
      }
      if (has('brandCode')) {
        const code = text(data.brandCode);
        if (code) {
          const brand = await manager.findOne(Brand, {
            where: { code, isActive: true },
          });
          if (!brand) {
            throw new BadRequestException(
              `Brand "${code}" not found or inactive`,
            );
          }
          product.brandId = brand.id;
          product.brand = brand;
        } else {
          product.brandId = null;
          product.brand = null;
        }
      }
      if (has('supplierCode')) {
        const code = text(data.supplierCode);
        if (code) {
          const supplier = await manager.findOne(Supplier, {
            where: { code, isActive: true },
          });
          if (!supplier) {
            throw new BadRequestException(
              `Supplier "${code}" not found or inactive`,
            );
          }
          product.supplierId = supplier.id;
          product.supplier = supplier;
        } else {
          product.supplierId = null;
          product.supplier = null;
        }
      }

      if (has('sku')) {
        const sku = text(data.sku);
        if (!sku) throw new BadRequestException('SKU is required');
        const taken =
          (await manager.findOne(Product, { where: { sku, id: Not(id) } })) ||
          (await manager.findOne(ProductVariant, { where: { sku } }));
        if (taken) {
          throw new BadRequestException(`SKU "${sku}" is already used`);
        }
        product.sku = sku;
      }
      if (has('barcode')) {
        const barcode = text(data.barcode);
        if (barcode) {
          const taken =
            (await manager.findOne(Product, {
              where: { barcode, id: Not(id) },
            })) || (await manager.findOne(ProductVariant, { where: { barcode } }));
          if (taken) {
            throw new BadRequestException(
              `Barcode "${barcode}" is already used`,
            );
          }
          product.barcode = barcode;
        } else {
          // Never leave a product without a barcode: scanning relies on it.
          product.barcode = await this.barcodesService.generateUniqueBarcode();
        }
      }

      if (has('costPrice')) product.costPrice = money(data.costPrice, 'Cost price');
      if (has('sellingPrice')) {
        product.sellingPrice = money(data.sellingPrice, 'Selling price');
      }
      if (has('minimumStock')) {
        product.minimumStock = money(data.minimumStock, 'Minimum stock');
      }
      if (has('maximumStock')) {
        product.maximumStock = optionalMoney(data.maximumStock, 'Maximum stock');
      }
      if (
        product.maximumStock !== null &&
        Number(product.maximumStock) < Number(product.minimumStock)
      ) {
        throw new BadRequestException(
          'Maximum stock cannot be lower than minimum stock',
        );
      }

      await manager.save(Product, product);

      // Variants: matched by their code; only existing ones can be edited.
      if (Array.isArray(data.variants)) {
        for (const v of data.variants) {
          const code = text(v?.code ?? v?.variantCode);
          const variant = product.variants?.find((x) => x.code === code);
          if (!variant) {
            throw new BadRequestException(
              `Variant "${code}" does not belong to this product`,
            );
          }
          const vHas = (key: string) => v[key] !== undefined;

          if (vHas('name')) {
            const name = text(v.name);
            if (!name) {
              throw new BadRequestException('Variant name is required');
            }
            variant.name = name;
          }
          if (vHas('sku')) {
            const sku = text(v.sku);
            if (!sku) throw new BadRequestException('Variant SKU is required');
            const taken =
              (await manager.findOne(ProductVariant, {
                where: { sku, id: Not(variant.id) },
              })) || (await manager.findOne(Product, { where: { sku } }));
            if (taken) {
              throw new BadRequestException(`SKU "${sku}" is already used`);
            }
            variant.sku = sku;
          }
          if (vHas('barcode')) {
            const barcode = text(v.barcode);
            if (barcode) {
              const taken =
                (await manager.findOne(ProductVariant, {
                  where: { barcode, id: Not(variant.id) },
                })) || (await manager.findOne(Product, { where: { barcode } }));
              if (taken) {
                throw new BadRequestException(
                  `Barcode "${barcode}" is already used`,
                );
              }
              variant.barcode = barcode;
            } else {
              variant.barcode =
                await this.barcodesService.generateUniqueBarcode();
            }
          }
          if (vHas('attributes')) {
            variant.attributes =
              v.attributes && typeof v.attributes === 'object'
                ? v.attributes
                : null;
          }
          if (vHas('costPrice')) {
            variant.costPrice = optionalMoney(v.costPrice, 'Variant cost price');
          }
          if (vHas('sellingPrice')) {
            variant.sellingPrice = optionalMoney(
              v.sellingPrice,
              'Variant selling price',
            );
          }
          await manager.save(ProductVariant, variant);
        }
      }
    });

    // Same shape as the list, so the app can refresh the row in place.
    const fresh = await this.productRepository
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
      .where('product.id = :id', { id })
      .getOne();
    if (!fresh) throw new NotFoundException('Product not found');
    return { message: 'Product updated', product: this.formatProduct(fresh) };
  }

  /** Sets (or replaces) the product photo with an already uploaded image URL. */
  async updateImage(id: string, imageUrl: string) {
    const product = await this.findOne(id);
    product.image = imageUrl;
    await this.productRepository.save(product);
    return { message: 'Product image updated', image: imageUrl };
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    // Collect all associated Cloudinary images to clean up
    const imageUrlsToDelete: (string | null | undefined)[] = [product.image];
    if (product.variants?.length) {
      for (const variant of product.variants) {
        if (variant.image) {
          imageUrlsToDelete.push(variant.image);
        }
      }
    }

    try {
      await this.productRepository.remove(product);

      // Clean up Cloudinary assets in background after successful DB deletion
      await deleteMultipleCloudinaryImages(imageUrlsToDelete);

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

  async createFromMultipart(
    body: any,
    files: Express.Multer.File[],
    userId: string,
  ) {
    const parseField = (field: any) => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    const product =
      parseField(body.product) ?? (body.productCode ? body : undefined);
    const variants = parseField(body.variants);
    const stock = parseField(body.stock);

    const dto = {
      product,
      variants,
      stock,
      remark: body.remark ?? null,
    };

    let productImageUrl: string | undefined;
    const variantImageUrls: Record<string, string> = {};

    for (const file of files ?? []) {
      if (file.fieldname === 'image') {
        productImageUrl = file.path;
        continue;
      }

      const match = file.fieldname.match(/^variantImage\[(.+)\]$/);
      if (match) {
        variantImageUrls[match[1]] = file.path;
      }
    }

    return this.createDirect(dto, userId, productImageUrl, variantImageUrls);
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

  async createForPurchaseOrder(
    manager: EntityManager,
    line: {
      name: string;
      categoryCode: string;
      brandCode?: string | null;
      supplierCode?: string | null;
      unit: string;
      sku: string | null;
      costPrice: number;
      warehouseCode: string;
      quantity: number;
      location?: string | null;
    },
  ) {
    return this.insertProductDirect(manager, {
      product: {
        productName: line.name,
        categoryCode: line.categoryCode,
        brandCode: line.brandCode ?? undefined,
        supplierCode: line.supplierCode ?? undefined,
        unit: line.unit,
        productSku: line.sku ?? undefined,
        productCostPrice: line.costPrice,
        hasVariants: false,
      },
      variants: [],
      stock: [
        {
          warehouseCode: line.warehouseCode,
          quantity: line.quantity,
          location: line.location ?? undefined,
        },
      ],
    });
  }

  async createManyDirect(
    batchItems: ProductDirectCreateBatchItem[],
    _userId?: string,
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

  async previewManyDirect(batchItems: ProductDirectCreateBatchItem[]) {
    if (!batchItems || batchItems.length === 0) {
      throw new BadRequestException('No products to import');
    }

    class PreviewRollback extends Error {
      constructor(public readonly rows: Record<string, unknown>[]) {
        super('import preview rollback');
      }
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const rows: Record<string, unknown>[] = [];
        for (const item of batchItems) {
          const p: any = await this.insertProductDirect(manager, item);
          rows.push({
            code: p.code,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            category: p.category?.name ?? item.product.categoryCode,
            costPrice: p.costPrice,
            sellingPrice: p.sellingPrice,
            variantCount: (p.variants ?? []).length,
            warehouses: [
              ...new Set(item.stock.map((s) => s.warehouseCode)),
            ].join(', '),
            quantity: (p.stocks ?? []).reduce(
              (sum: number, stk: any) => sum + Number(stk.quantity),
              0,
            ),
            imageUrl: p.image ?? null,
          });
        }
        // Throwing is what rolls the transaction back.
        throw new PreviewRollback(rows);
      });
    } catch (e) {
      if (e instanceof PreviewRollback) {
        return { ok: true, count: e.rows.length, rows: e.rows };
      }
      throw e;
    }
    return { ok: true, count: 0, rows: [] };
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
    let code: string | undefined = productData.productCode ?? productData.code;
    const name = productData.productName ?? productData.name;
    const categoryCode = productData.categoryCode ?? productData.category;
    const brandCode = productData.brandCode ?? productData.brand ?? null;
    const supplierCode =
      productData.supplierCode ?? productData.supplier ?? null;
    const hasVariants =
      productData.hasVariants === true || productData.hasVariants === 'true';
    const unit = productData.unit;
    let sku: string | undefined = productData.productSku ?? productData.sku;
    let barcode = productData.productBarcode ?? productData.barcode ?? null;
    if (!barcode || (typeof barcode === 'string' && !barcode.trim())) {
      barcode = await this.barcodesService.generateUniqueBarcode();
    }
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
    if (!name) {
      throw new BadRequestException('Product name is required');
    }
    if (!categoryCode) {
      throw new BadRequestException('Category code is required');
    }
    if (!unit) {
      throw new BadRequestException('Unit is required');
    }

    // Auto-generate the internal product code (PRD-0001, ...) when not supplied.
    if (!code || !String(code).trim()) {
      code = await this.generateProductCode(manager);
    }
    code = String(code).trim();

    // Initial stock (warehouse + quantity >= 1) is required for a new product.
    if (!Array.isArray(dto.stock) || dto.stock.length === 0) {
      throw new BadRequestException(
        `Product "${code}": initial stock is required (warehouse and quantity of at least 1)`,
      );
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

    // SKU: use the supplied one (must be unique) or generate APL-IP15 style.
    if (sku && String(sku).trim()) {
      sku = String(sku).trim();
      const existingProductBySku = await manager.findOne(Product, {
        where: { sku },
      });
      if (existingProductBySku) {
        throw new BadRequestException(
          `Product with SKU "${sku}" already exists`,
        );
      }
    } else {
      sku = await this.generateUniqueSku(manager, brand?.code ?? null, name);
    }

    // 2. Create and persist Product directly
    const product = manager.create(Product, {
      code,
      name,
      image: productImageUrl ?? productData.imageUrl ?? null,
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
      const vCode =
        v.variantCode ?? v.code ?? `${code}-V${savedVariants.length + 1}`;
      const vName = v.variantName ?? v.name;
      const vSku = v.variantSku ?? v.sku ?? `${sku}-V${savedVariants.length + 1}`;
      let vBarcode = v.variantBarcode ?? v.barcode ?? null;
      if (!vBarcode || (typeof vBarcode === 'string' && !vBarcode.trim())) {
        vBarcode = await this.barcodesService.generateUniqueBarcode();
      }
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

      // The initial stock must fit in the warehouse (earlier rows of this
      // same save are already counted: they are in the same transaction).
      const load = await loadWarehouse(manager, warehouse.id);
      if (load && load.capacity !== null) {
        assertFits({ ...load, incoming: 0 }, quantity);
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
        location: s.location?.toString().trim() || null,
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
