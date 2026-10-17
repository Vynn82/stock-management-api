import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { GoodsReceipt } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  ReceivePurchaseOrderDto,
} from './dto/purchase-order.dto';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import { User } from '../users/entities/user.entity';
import { PurchaseOrdersExcelService } from './purchase-orders-excel.service';
import {
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

type ResolvedLine = {
  productId: string | null;
  variantId: string | null;
  newProductName: string | null;
  newProductCategoryId: string | null;
  newProductUnit: string | null;
  newProductSku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/**
 * Purchase orders and goods receiving.
 *
 *   DRAFT -> SUBMITTED -> APPROVED -> PARTIALLY_RECEIVED -> RECEIVED
 *                    \-> REJECTED -> (edit) -> DRAFT / SUBMITTED
 *
 * A purchase order never touches stock by itself. Stock goes up only when
 * goods are received ([receive]), for the quantity that actually arrived.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    private readonly dataSource: DataSource,
    private readonly excel: PurchaseOrdersExcelService,
  ) {}

  // ------------------------------------------------------------------ create

  async create(dto: CreatePurchaseOrderDto, userId: string) {
    const id = await this.dataSource.transaction(async (manager) => {
      const { supplier, warehouse, lines, total } = await this.resolve(
        manager,
        dto,
      );
      const poNumber = await this.nextNumber(
        manager,
        'purchase_order_number_seq',
        'PO',
      );

      const po = await manager.save(
        PurchaseOrder,
        manager.create(PurchaseOrder, {
          poNumber,
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          status: dto.submit
            ? PurchaseOrderStatus.SUBMITTED
            : PurchaseOrderStatus.DRAFT,
          note: dto.note?.trim() || null,
          totalAmount: total,
          createdById: userId,
        }),
      );

      await manager.save(
        PurchaseOrderItem,
        lines.map((line) =>
          manager.create(PurchaseOrderItem, {
            ...line,
            purchaseOrderId: po.id,
            receivedQuantity: 0,
          }),
        ),
      );
      return po.id;
    });

    return this.findOne(id);
  }

  /** Only the person who made it can change it, and only while it is a draft or was rejected. */
  async update(id: string, dto: CreatePurchaseOrderDto, userId: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertCreator(po, userId);
      this.assertStatus(po, [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.REJECTED,
      ]);

      const { supplier, warehouse, lines, total } = await this.resolve(
        manager,
        dto,
      );

      po.supplierId = supplier.id;
      po.warehouseId = warehouse.id;
      po.note = dto.note?.trim() || null;
      po.totalAmount = total;
      po.status = dto.submit
        ? PurchaseOrderStatus.SUBMITTED
        : PurchaseOrderStatus.DRAFT;
      po.rejectionReason = null;
      po.approvedById = null;
      po.approvedAt = null;
      await manager.save(PurchaseOrder, po);

      await manager.delete(PurchaseOrderItem, { purchaseOrderId: id });
      await manager.save(
        PurchaseOrderItem,
        lines.map((line) =>
          manager.create(PurchaseOrderItem, {
            ...line,
            purchaseOrderId: id,
            receivedQuantity: 0,
          }),
        ),
      );
    });

    return this.findOne(id);
  }

  // ------------------------------------------------------------------ import

  /**
   * Reads an Excel / CSV file and checks every row against the catalogue.
   * Nothing is saved: the caller gets each row back with either the product
   * it matched or the reason it did not, then builds the order from the good
   * rows.
   */
  async previewImport(file: Express.Multer.File) {
    const parsed = this.excel.parse(file);
    const manager = this.dataSource.manager;

    const codes = [...new Set(parsed.map((r) => r.productCode).filter(Boolean))];
    const products = codes.length
      ? await manager.find(Product, { where: { code: In(codes), isActive: true } })
      : [];
    const productByCode = new Map(products.map((p) => [p.code, p]));
    const variants = products.length
      ? await manager.find(ProductVariant, {
          where: { productId: In(products.map((p) => p.id)), isActive: true },
        })
      : [];

    // For new-product rows: their categories, and which SKUs are already taken.
    const categoryCodes = [
      ...new Set(parsed.map((r) => r.categoryCode).filter((c): c is string => !!c)),
    ];
    const categories = categoryCodes.length
      ? await manager.find(Category, { where: { code: In(categoryCodes), isActive: true } })
      : [];
    const categoryByCode = new Map(categories.map((c) => [c.code, c]));
    // A new-product row without category_code falls back to the first active
    // category (handy for testing; a real category_code always wins).
    const fallbackCategory = parsed.some((r) => !r.productCode && !r.categoryCode)
      ? await manager.findOne(Category, { where: { isActive: true }, order: { code: 'ASC' } })
      : null;

    const skus = [...new Set(parsed.map((r) => r.sku).filter((v): v is string => !!v))];
    const takenSkus = new Set<string>();
    if (skus.length) {
      for (const p of await manager.find(Product, { where: { sku: In(skus) } })) takenSkus.add(p.sku);
      for (const v of await manager.find(ProductVariant, { where: { sku: In(skus) } })) takenSkus.add(v.sku);
    }

    type PreviewRow = {
      row: number;
      productCode: string | null;
      variantCode: string | null;
      productName: string | null;
      variantName: string | null;
      isNew: boolean;
      categoryCode: string | null;
      categoryName: string | null;
      unit: string | null;
      sku: string | null;
      quantity: number | null;
      unitPrice: number | null;
      error: string | null;
    };

    const seen = new Map<string, number>();
    const rows: PreviewRow[] = parsed.map((r) => {
      const base: PreviewRow = {
        row: r.row,
        productCode: r.productCode || null,
        variantCode: r.variantCode,
        productName: r.newProductName,
        variantName: null,
        isNew: false,
        categoryCode: r.categoryCode,
        categoryName: null,
        unit: r.unit,
        sku: r.sku,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        error: null,
      };
      const fail = (error: string): PreviewRow => ({ ...base, error });

      if (r.quantity === null || r.quantity <= 0) {
        return fail('quantity must be a number greater than 0');
      }
      if (r.unitPrice !== null && r.unitPrice < 0) {
        return fail('unit_price cannot be negative');
      }

      // ---- A product that is not in the catalogue yet.
      if (!r.productCode) {
        if (!r.newProductName) {
          return fail('Fill product_code, or new_product_name for a new product');
        }
        const category = r.categoryCode ? categoryByCode.get(r.categoryCode) : fallbackCategory;
        if (!category) {
          return fail(
            r.categoryCode ? 'Category not found or inactive' : 'No active category exists yet',
          );
        }
        if (r.sku && takenSkus.has(r.sku)) return fail(`SKU "${r.sku}" already exists`);

        const key = `new|${r.newProductName.toLowerCase()}|${category.id}`;
        const first = seen.get(key);
        if (first !== undefined) return fail(`Duplicate of row ${first}`);
        seen.set(key, r.row);

        return {
          ...base,
          isNew: true,
          productName: r.newProductName,
          categoryCode: category.code,
          categoryName: category.name,
          unit: r.unit || 'PCS',
          quantity: r3(r.quantity),
          unitPrice: r2(r.unitPrice ?? 0),
        };
      }

      // ---- An existing product.
      const product = productByCode.get(r.productCode);
      if (!product) return fail('Product not found or inactive');

      let variant: ProductVariant | undefined;
      if (r.variantCode) {
        variant = variants.find(
          (v) => v.productId === product.id && v.code === r.variantCode,
        );
        if (!variant) return fail('Variant not found for this product');
      } else if (product.hasVariants) {
        return fail('This product has variants: variant_code is required');
      }

      const key = `${product.id}|${variant?.id ?? ''}`;
      const first = seen.get(key);
      if (first !== undefined) return fail(`Duplicate of row ${first}`);
      seen.set(key, r.row);

      return {
        ...base,
        productCode: product.code,
        variantCode: variant?.code ?? null,
        productName: product.name,
        variantName: variant?.name ?? null,
        quantity: r3(r.quantity),
        // Empty price -> the cost price already on file.
        unitPrice: r2(r.unitPrice ?? Number(variant?.costPrice ?? product.costPrice ?? 0)),
      };
    });

    const errorCount = rows.filter((r) => r.error).length;
    return {
      rows,
      validCount: rows.length - errorCount,
      errorCount,
    };
  }

  /**
   * Excel in the Add Product import format, filled in for the new-product
   * lines that arrived but are not in the catalogue yet. The manager adds the
   * missing details (SKU, brand, price, image_url...) and imports it, which
   * creates the products with the counted quantity as initial stock.
   */
  async pendingProductsFile(id: string) {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: { warehouse: true, items: { newProductCategory: true } },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    const received = po.items.filter(
      (item) => !item.productId && Number(item.receivedQuantity) > 0,
    );
    // Normally only the lines still waiting; once all are marked as added the
    // manager can still re-export them (e.g. marked by mistake / import failed).
    const waiting = received.filter((item) => !item.catalogAddedAt);
    const pending = waiting.length > 0 ? waiting : received;
    if (pending.length === 0) {
      throw new BadRequestException(
        'This purchase order has no received new products',
      );
    }

    return {
      name: `${po.poNumber}_new_products.xlsx`,
      file: this.excel.generateProductImport(
        pending.map((item) => ({
          name: item.newProductName ?? '',
          categoryCode: item.newProductCategory?.code ?? '',
          unit: item.newProductUnit || 'PCS',
          sku: item.newProductSku,
          warehouseCode: po.warehouse.code,
          quantity: Number(item.receivedQuantity),
          unitPrice: Number(item.unitPrice),
        })),
        po.poNumber,
      ),
    };
  }

  /** The manager has added these products to the catalogue: stop listing them as waiting. */
  async markCatalogAdded(id: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertStatus(po, [
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.RECEIVED,
      ]);
      await manager
        .createQueryBuilder()
        .update(PurchaseOrderItem)
        .set({ catalogAddedAt: () => 'now()' })
        .where('purchase_order_id = :id', { id })
        .andWhere('product_id IS NULL')
        .andWhere('catalog_added_at IS NULL')
        .andWhere('received_quantity > 0')
        .execute();
    });
    return this.findOne(id);
  }

  /** Template filled with real product / category codes from the database. */
  async templateFile() {
    const products = await this.dataSource.manager.find(Product, {
      where: { isActive: true },
      relations: { variants: true },
      order: { code: 'ASC' },
      take: 300,
    });
    const categories = await this.dataSource.manager.find(Category, {
      where: { isActive: true },
      order: { code: 'ASC' },
      take: 300,
    });
    return this.excel.generateTemplate({
      products: products.map((p) => ({
        code: p.code,
        name: p.name,
        sku: p.sku,
        variants: (p.hasVariants ? (p.variants ?? []) : [])
          .filter((v) => v.isActive)
          .map((v) => ({ code: v.code, name: v.name, sku: v.sku })),
      })),
      categories: categories.map((c) => ({ code: c.code, name: c.name })),
    });
  }

  // ---------------------------------------------------------------- workflow

  async submit(id: string, userId: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertCreator(po, userId);
      this.assertStatus(po, [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.REJECTED,
      ]);
      po.status = PurchaseOrderStatus.SUBMITTED;
      po.rejectionReason = null;
      po.approvedById = null;
      po.approvedAt = null;
      await manager.save(PurchaseOrder, po);
    });
    return this.findOne(id);
  }

  async approve(id: string, userId: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertStatus(po, [PurchaseOrderStatus.SUBMITTED]);
      this.assertNotCreator(po, userId);
      po.status = PurchaseOrderStatus.APPROVED;
      po.approvedById = userId;
      po.approvedAt = new Date();
      po.rejectionReason = null;
      await manager.save(PurchaseOrder, po);
    });
    return this.findOne(id);
  }

  async reject(id: string, userId: string, reason: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertStatus(po, [PurchaseOrderStatus.SUBMITTED]);
      this.assertNotCreator(po, userId);
      po.status = PurchaseOrderStatus.REJECTED;
      po.approvedById = userId; // who made the decision
      po.approvedAt = new Date();
      po.rejectionReason = reason.trim();
      await manager.save(PurchaseOrder, po);
    });
    return this.findOne(id);
  }

  // --------------------------------------------------------------- receiving

  /**
   * Goods receiving: records one delivery and puts the quantities that
   * arrived into the purchase order's warehouse. Everything happens in one
   * transaction, so a receipt never exists without its stock (or the
   * reverse). A PO can be received in several deliveries.
   */
  async receive(id: string, dto: ReceivePurchaseOrderDto, userId: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertStatus(po, [
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
      ]);

      const items = await manager.find(PurchaseOrderItem, {
        where: { purchaseOrderId: id },
      });
      const byId = new Map(items.map((item) => [item.id, item]));

      const seen = new Set<string>();
      for (const line of dto.items) {
        const item = byId.get(line.itemId);
        if (!item) {
          throw new BadRequestException(
            'An item does not belong to this purchase order',
          );
        }
        if (seen.has(line.itemId)) {
          throw new BadRequestException(
            'The same item is listed more than once',
          );
        }
        seen.add(line.itemId);

        const remaining = r3(Number(item.quantity) - Number(item.receivedQuantity));
        if (r3(line.quantity) > remaining) {
          throw new BadRequestException(
            `Cannot receive ${line.quantity}: only ${remaining} still to come for this item`,
          );
        }
      }

      const receiptNumber = await this.nextNumber(
        manager,
        'goods_receipt_number_seq',
        'GR',
      );
      const receipt = await manager.save(
        GoodsReceipt,
        manager.create(GoodsReceipt, {
          receiptNumber,
          purchaseOrderId: id,
          receivedById: userId,
          note: dto.note?.trim() || null,
        }),
      );

      for (const line of dto.items) {
        const item = byId.get(line.itemId)!;
        const quantity = r3(line.quantity);

        await manager.save(
          GoodsReceiptItem,
          manager.create(GoodsReceiptItem, {
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: item.id,
            quantity,
          }),
        );

        // A new-product line is not in the catalogue yet, so it cannot go into
        // stock. The count is only recorded; the manager adds the product
        // (Add Product import, with this quantity as initial stock) afterwards.
        if (!item.productId) {
          item.receivedQuantity = r3(Number(item.receivedQuantity) + quantity);
          await manager.save(PurchaseOrderItem, item);
          continue;
        }
        const productId = item.productId;

        // Stock goes up in the warehouse the PO was made for.
        const stock = await manager.findOne(Stock, {
          where: {
            productId,
            warehouseId: po.warehouseId,
            variantId: item.variantId ?? IsNull(),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (stock) {
          stock.quantity = r3(Number(stock.quantity) + quantity);
          await manager.save(Stock, stock);
        } else {
          await manager.save(
            Stock,
            manager.create(Stock, {
              productId,
              variantId: item.variantId,
              warehouseId: po.warehouseId,
              quantity,
              location: null,
            }),
          );
        }

        // Same audit trail as every other stock change.
        await manager.save(
          StockAdjustment,
          manager.create(StockAdjustment, {
            requestId: null,
            adjustedById: userId,
            productId,
            variantId: item.variantId,
            warehouseId: po.warehouseId,
            adjustmentType: 'INCREASE',
            quantity,
            reason: `Goods receipt ${receiptNumber} (${po.poNumber})`,
          }),
        );

        item.receivedQuantity = r3(Number(item.receivedQuantity) + quantity);
        await manager.save(PurchaseOrderItem, item);
      }

      const complete = items.every(
        (item) => r3(Number(item.receivedQuantity)) >= r3(Number(item.quantity)),
      );
      po.status = complete
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;
      await manager.save(PurchaseOrder, po);
    });

    return this.findOne(id);
  }

  // ------------------------------------------------------------------- reads

  async findAll(query: PurchaseOrderQueryDto) {
    const { limit, skip } = getPaginationOptions(query);
    const search = query.search?.trim();

    const qb = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.warehouse', 'warehouse')
      .leftJoinAndSelect('po.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.profile', 'createdByProfile');

    if (query.status) {
      qb.andWhere('po.status = :status', { status: query.status });
    }
    if (search) {
      qb.andWhere('(po.poNumber ILIKE :search OR supplier.name ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('po.createdAt', 'DESC').skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    // How many products each order has (one grouped query for the whole page).
    const counts = new Map<string, number>();
    if (rows.length > 0) {
      const raw: Array<{ poId: string; n: string }> = await this.dataSource
        .createQueryBuilder(PurchaseOrderItem, 'item')
        .select('item.purchaseOrderId', 'poId')
        .addSelect('COUNT(*)', 'n')
        .where('item.purchaseOrderId IN (:...ids)', { ids: rows.map((r) => r.id) })
        .groupBy('item.purchaseOrderId')
        .getRawMany();
      for (const r of raw) counts.set(r.poId, Number(r.n));
    }

    // Lines received but still waiting to be added to the catalogue.
    const pending = new Map<string, number>();
    if (rows.length > 0) {
      const raw: Array<{ poId: string; n: string }> = await this.dataSource
        .createQueryBuilder(PurchaseOrderItem, 'item')
        .select('item.purchaseOrderId', 'poId')
        .addSelect('COUNT(*)', 'n')
        .where('item.purchaseOrderId IN (:...ids)', { ids: rows.map((r) => r.id) })
        .andWhere('item.productId IS NULL')
        .andWhere('item.catalogAddedAt IS NULL')
        .andWhere('item.receivedQuantity > 0')
        .groupBy('item.purchaseOrderId')
        .getRawMany();
      for (const r of raw) pending.set(r.poId, Number(r.n));
    }

    const data = rows.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      totalAmount: Number(po.totalAmount),
      itemCount: counts.get(po.id) ?? 0,
      pendingCatalogCount: pending.get(po.id) ?? 0,
      supplier: { code: po.supplier.code, name: po.supplier.name },
      warehouse: { code: po.warehouse.code, name: po.warehouse.name },
      createdBy: this.person(po.createdBy),
      createdAt: po.createdAt,
    }));

    return createPaginatedResult(data, total, query);
  }

  async findOne(id: string) {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: {
        supplier: true,
        warehouse: true,
        createdBy: { profile: true },
        approvedBy: { profile: true },
        items: { product: true, variant: true, newProductCategory: true },
        receipts: {
          receivedBy: { profile: true },
          items: { purchaseOrderItem: { product: true, variant: true } },
        },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    const items = [...po.items]
      .map((item) => ({
        id: item.id,
        productCode: item.product?.code ?? null,
        productName: item.product?.name ?? item.newProductName ?? '',
        isNew: !item.productId,
        // Received, but the product is not in the catalogue yet (no stock).
        pendingCatalog:
          !item.productId &&
          Number(item.receivedQuantity) > 0 &&
          !item.catalogAddedAt,
        catalogAdded: !item.productId && !!item.catalogAddedAt,
        // Only while the product does not exist yet.
        newProduct: item.productId
          ? null
          : {
              name: item.newProductName,
              categoryCode: item.newProductCategory?.code ?? null,
              categoryName: item.newProductCategory?.name ?? null,
              unit: item.newProductUnit,
              sku: item.newProductSku,
            },
        image: item.variant?.image ?? item.product?.image ?? null,
        variantCode: item.variant?.code ?? null,
        variantName: item.variant?.name ?? null,
        quantity: Number(item.quantity),
        receivedQuantity: Number(item.receivedQuantity),
        remainingQuantity: r3(Number(item.quantity) - Number(item.receivedQuantity)),
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      }))
      .sort((a, b) =>
        `${a.productName}${a.variantName ?? ''}`.localeCompare(
          `${b.productName}${b.variantName ?? ''}`,
        ),
      );

    const receipts = [...po.receipts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((receipt) => ({
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        note: receipt.note,
        receivedBy: this.person(receipt.receivedBy),
        createdAt: receipt.createdAt,
        items: receipt.items.map((line) => ({
          productName:
            line.purchaseOrderItem.product?.name ??
            line.purchaseOrderItem.newProductName ??
            '',
          variantName: line.purchaseOrderItem.variant?.name ?? null,
          quantity: Number(line.quantity),
        })),
      }));

    return {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      note: po.note,
      totalAmount: Number(po.totalAmount),
      rejectionReason: po.rejectionReason,
      supplier: { code: po.supplier.code, name: po.supplier.name },
      warehouse: { code: po.warehouse.code, name: po.warehouse.name },
      createdBy: this.person(po.createdBy),
      decidedBy: po.approvedBy ? this.person(po.approvedBy) : null,
      decidedAt: po.approvedAt,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      pendingCatalogCount: items.filter((i) => i.pendingCatalog).length,
      items,
      receipts,
    };
  }

  // ----------------------------------------------------------------- helpers

  /** Looks up supplier, warehouse and products by code and prices every line. */
  private async resolve(manager: EntityManager, dto: CreatePurchaseOrderDto) {
    const supplier = await manager.findOne(Supplier, {
      where: { code: dto.supplierCode.trim().toUpperCase(), isActive: true },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Supplier "${dto.supplierCode}" not found or inactive`,
      );
    }

    const warehouse = await manager.findOne(Warehouse, {
      where: { code: dto.warehouseCode.trim().toUpperCase(), isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse "${dto.warehouseCode}" not found or inactive`,
      );
    }

    const lines: ResolvedLine[] = [];
    const seen = new Set<string>();

    for (const [index, row] of dto.items.entries()) {
      const label = `Item ${index + 1} (${row.productCode ?? row.newProduct?.name ?? ''})`;

      const quantity = r3(row.quantity);
      const unitPrice = r2(row.unitPrice);

      // ---- A product that does not exist yet: created when it is received.
      if (!row.productCode?.trim()) {
        const np = row.newProduct;
        if (!np) {
          throw new BadRequestException(
            `${label}: give an existing product or a new product`,
          );
        }
        const name = np.name.trim();
        if (!name) throw new BadRequestException(`${label}: name is required`);

        const category = await manager.findOne(Category, {
          where: { code: np.categoryCode.trim().toUpperCase(), isActive: true },
        });
        if (!category) {
          throw new NotFoundException(`${label}: category not found or inactive`);
        }

        const sku = np.sku?.trim() || null;
        if (sku) {
          const taken =
            (await manager.findOne(Product, { where: { sku } })) ||
            (await manager.findOne(ProductVariant, { where: { sku } }));
          if (taken) {
            throw new BadRequestException(`${label}: SKU "${sku}" already exists`);
          }
        }

        const newKey = `new|${name.toLowerCase()}|${category.id}`;
        if (seen.has(newKey) || (sku && seen.has(`sku|${sku}`))) {
          throw new BadRequestException(`${label}: listed more than once`);
        }
        seen.add(newKey);
        if (sku) seen.add(`sku|${sku}`);

        lines.push({
          productId: null,
          variantId: null,
          newProductName: name,
          newProductCategoryId: category.id,
          newProductUnit: np.unit?.trim() || 'PCS',
          newProductSku: sku,
          quantity,
          unitPrice,
          lineTotal: r2(quantity * unitPrice),
        });
        continue;
      }

      const product = await manager.findOne(Product, {
        where: { code: row.productCode.trim(), isActive: true },
      });
      if (!product) {
        throw new NotFoundException(`${label}: product not found or inactive`);
      }

      let variant: ProductVariant | null = null;
      if (row.variantCode?.trim()) {
        variant = await manager.findOne(ProductVariant, {
          where: {
            code: row.variantCode.trim(),
            productId: product.id,
            isActive: true,
          },
        });
        if (!variant) {
          throw new NotFoundException(`${label}: variant not found or inactive`);
        }
      } else if (product.hasVariants) {
        throw new BadRequestException(`${label}: choose a variant`);
      }

      const key = `${product.id}|${variant?.id ?? ''}`;
      if (seen.has(key)) {
        throw new BadRequestException(`${label}: listed more than once`);
      }
      seen.add(key);

      lines.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        newProductName: null,
        newProductCategoryId: null,
        newProductUnit: null,
        newProductSku: null,
        quantity,
        unitPrice,
        lineTotal: r2(quantity * unitPrice),
      });
    }

    const total = r2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    return { supplier, warehouse, lines, total };
  }

  private async nextNumber(
    manager: EntityManager,
    sequence: string,
    prefix: string,
  ) {
    const rows: Array<{ n: string }> = await manager.query(
      `SELECT nextval('${sequence}') AS n`,
    );
    return `${prefix}-${String(rows[0].n).padStart(5, '0')}`;
  }

  /** Loads the PO with a row lock so two people can't change it at once. */
  private async lock(manager: EntityManager, id: string) {
    const po = await manager.findOne(PurchaseOrder, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  private assertStatus(po: PurchaseOrder, allowed: PurchaseOrderStatus[]) {
    if (!allowed.includes(po.status)) {
      throw new BadRequestException(
        `This purchase order is ${po.status}, so this action is not allowed`,
      );
    }
  }

  private assertCreator(po: PurchaseOrder, userId: string) {
    if (po.createdById !== userId) {
      throw new ForbiddenException(
        'Only the person who created this purchase order can do this',
      );
    }
  }

  private assertNotCreator(po: PurchaseOrder, userId: string) {
    if (po.createdById === userId) {
      throw new ForbiddenException(
        'You cannot approve or reject your own purchase order',
      );
    }
  }

  private person(user: User | null | undefined) {
    if (!user) return null;
    const name = [user.profile?.firstName, user.profile?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return { id: user.id, staffId: user.staffId, name: name || user.staffId };
  }
}
