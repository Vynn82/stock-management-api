import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  forwardRef,
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
  GoodsReceiptIssue,
  ReceiptIssueReason,
} from './entities/goods-receipt-issue.entity';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  ReceivePurchaseOrderDto,
} from './dto/purchase-order.dto';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Category } from '../categories/entities/category.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { ProductsService } from '../products/products.service';
import { PurchaseOrdersExcelService } from './purchase-orders-excel.service';
import { CustomerOrdersService } from '../customer-orders/customer-orders.service';
import {
  assertFits,
  evaluateCapacity,
  loadWarehouse,
} from '../warehouses/warehouse-capacity';
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
  newProductBrandId: string | null;
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
 *                                          \-> CLOSED (rest not coming)
 *                    \-> REJECTED -> (edit) -> DRAFT / SUBMITTED
 *
 * A Manager's order is SUBMITTED to the Admin / Super Admin they pick, who
 * approves or rejects it. An Admin / Super Admin's own order skips that and
 * is APPROVED as soon as it is submitted.
 *
 * A purchase order never touches stock by itself. Stock goes up only when
 * goods are received ([receive]), for the quantity that actually arrived. A
 * new-product line is added to the catalogue at that moment, with the
 * received quantity as its stock.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    private readonly dataSource: DataSource,
    private readonly excel: PurchaseOrdersExcelService,
    private readonly products: ProductsService,
    @Optional()
    @Inject(forwardRef(() => CustomerOrdersService))
    private readonly customerOrdersService?: CustomerOrdersService,
  ) {}

  // ------------------------------------------------------------------ create

  async create(dto: CreatePurchaseOrderDto, userId: string) {
    const id = await this.dataSource.transaction(async (manager) => {
      const { supplier, warehouse, lines, total } = await this.resolve(
        manager,
        dto,
      );
      if (dto.submit) {
        await this.assertRoom(
          manager,
          warehouse.id,
          null,
          lines.reduce((sum, line) => sum + line.quantity, 0),
        );
      }
      const poNumber = await this.nextNumber(
        manager,
        'purchase_order_number_seq',
        'PO',
      );

      const draft = manager.create(PurchaseOrder, {
        poNumber,
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        status: PurchaseOrderStatus.DRAFT,
        note: dto.note?.trim() || null,
        totalAmount: total,
        createdById: userId,
      });
      if (dto.submit) {
        await this.routeForApproval(manager, draft, userId, dto.approverId);
      }
      const po = await manager.save(PurchaseOrder, draft);

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

      if (dto.submit) {
        await this.assertRoom(
          manager,
          warehouse.id,
          id,
          lines.reduce((sum, line) => sum + line.quantity, 0),
        );
      }
      po.supplierId = supplier.id;
      po.warehouseId = warehouse.id;
      po.note = dto.note?.trim() || null;
      po.totalAmount = total;
      po.status = PurchaseOrderStatus.DRAFT;
      po.rejectionReason = null;
      po.approvedById = null;
      po.approvedAt = null;
      po.requestedApproverId = null;
      if (dto.submit) {
        await this.routeForApproval(manager, po, userId, dto.approverId);
      }
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

  /** Reads an Excel / CSV file and checks every row against the catalogue. */
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

  /** Excel in the Add Product import format, filled in for the new-product lines that arrived but are not in the catalogue yet. */
  async pendingProductsFile(id: string) {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: {
        warehouse: true,
        supplier: true,
        items: { newProductCategory: true, newProductBrand: true },
      },
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
          brandCode: item.newProductBrand?.code ?? null,
          supplierCode: po.supplier.code,
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
        PurchaseOrderStatus.CLOSED,
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

  /**
   * Who the caller may send a purchase order to for approval:
   *  - Super Admin: nobody (their orders are approved on the spot).
   *  - Admin: Super Admins only.
   *  - Anyone else (Manager): Admins or Super Admins.
   * The caller is never in the list.
   */
  async approvers(userId: string) {
    const me = await this.accessOf(this.dataSource.manager, userId);
    if (me.isSuperAdmin) return [];
    const allowedRoles = this.approverRolesFor(me);

    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE u.status = 'ACTIVE'
         AND u.id <> $1
         AND r.name = ANY($2)
         AND (r.name = 'SUPER_ADMIN' OR p.name = 'PO_APPROVE')`,
      [userId, allowedRoles],
    );
    if (rows.length === 0) return [];

    const users = await this.dataSource.manager.find(User, {
      where: { id: In(rows.map((r) => r.id)) },
      relations: { profile: true, userRoles: { role: true } },
    });
    return users
      .map((u) => ({
        ...this.person(u)!,
        roles: u.userRoles.map((ur) => ur.role.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ----------------------------------------------------------------- reorder

  /** Products whose stock is at or below their minimum (stock 0 = out of stock), out of stock first. */
  async reorderList(warehouseCode?: string) {
    const params: unknown[] = [];
    let join = 'LEFT JOIN stocks s ON s.product_id = p.id';
    const code = warehouseCode?.trim().toUpperCase();
    if (code) {
      params.push(code);
      join +=
        ' AND s.warehouse_id = (SELECT w.id FROM warehouses w WHERE w.code = $1)';
    }

    const rows: Array<{
      id: string;
      code: string;
      name: string;
      image: string | null;
      unit: string;
      hasVariants: boolean;
      minimumStock: string | null;
      maximumStock: string | null;
      stock: string;
    }> = await this.dataSource.query(
      `SELECT p.id, p.code, p.name, p.image, p.unit,
              p.has_variants AS "hasVariants",
              p.minimum_stock AS "minimumStock",
              p.maximum_stock AS "maximumStock",
              COALESCE(SUM(s.quantity), 0) AS stock
       FROM products p
       ${join}
       WHERE p.is_active = true
       GROUP BY p.id
       HAVING COALESCE(SUM(s.quantity), 0) <= COALESCE(p.minimum_stock, 0)
       ORDER BY COALESCE(SUM(s.quantity), 0) ASC, p.name ASC
       LIMIT 300`,
      params,
    );

    // Already on order: open purchase orders, quantity not received yet.
    const onOrder = new Map<string, { quantity: number; poNumbers: Set<string> }>();
    if (rows.length > 0) {
      const open: Array<{ productId: string; poNumber: string; remaining: string }> =
        await this.dataSource.query(
          `SELECT poi.product_id AS "productId", po.po_number AS "poNumber",
                  (poi.quantity - poi.received_quantity) AS remaining
           FROM purchase_order_items poi
           JOIN purchase_orders po ON po.id = poi.purchase_order_id
           WHERE poi.product_id = ANY($1::uuid[])
             AND po.status IN ('SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED')
             AND poi.quantity > poi.received_quantity`,
          [rows.map((r) => r.id)],
        );
      for (const line of open) {
        const entry = onOrder.get(line.productId) ?? {
          quantity: 0,
          poNumbers: new Set<string>(),
        };
        entry.quantity = r3(entry.quantity + Number(line.remaining));
        entry.poNumbers.add(line.poNumber);
        onOrder.set(line.productId, entry);
      }
    }

    const items = rows.map((r) => {
      const stock = Number(r.stock);
      const minimum = Number(r.minimumStock ?? 0);
      const maximum = r.maximumStock === null ? null : Number(r.maximumStock);
      const incoming = onOrder.get(r.id);
      const ordered = incoming?.quantity ?? 0;

      // Bring it up to the maximum; without one, to twice the minimum.
      const target = Math.max(maximum ?? (minimum > 0 ? minimum * 2 : 1), 1);
      const suggested = Math.max(Math.ceil(target - stock - ordered), 0);

      return {
        productId: r.id,
        code: r.code,
        name: r.name,
        image: r.image,
        unit: r.unit,
        hasVariants: r.hasVariants,
        stock: r3(stock),
        minimumStock: minimum,
        maximumStock: maximum,
        status: stock <= 0 ? 'OUT' : 'LOW',
        onOrder: ordered,
        onOrderPoNumbers: [...(incoming?.poNumbers ?? [])],
        suggestedQuantity: suggested,
        // Enough is already on its way.
        covered: suggested === 0,
      };
    });

    return {
      total: items.length,
      outCount: items.filter((i) => i.status === 'OUT').length,
      lowCount: items.filter((i) => i.status === 'LOW').length,
      items,
    };
  }

  /**
   * Every supplier this product was bought from (approved purchase orders),
   * with price and delivery speed, so the manager can pick who to order from.
   * The product's default supplier is listed too, even with no history yet.
   */
  async supplierHistory(productId: string) {
    const manager = this.dataSource.manager;
    const product = await manager.findOne(Product, { where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const rows: Array<{
      supplierId: string;
      supplierCode: string;
      supplierName: string;
      poId: string;
      poNumber: string;
      createdAt: Date;
      approvedAt: Date | null;
      firstReceiptAt: Date | null;
      unitPrice: string;
      quantity: string;
      receivedQuantity: string;
      status: string;
    }> = await this.dataSource.query(
      `SELECT sup.id AS "supplierId", sup.code AS "supplierCode", sup.name AS "supplierName",
              po.id AS "poId", po.po_number AS "poNumber",
              po.created_at AS "createdAt", po.approved_at AS "approvedAt",
              (SELECT MIN(gr.created_at) FROM goods_receipts gr
                WHERE gr.purchase_order_id = po.id) AS "firstReceiptAt",
              poi.unit_price AS "unitPrice", poi.quantity AS quantity,
              poi.received_quantity AS "receivedQuantity", po.status AS status
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.purchase_order_id
       JOIN suppliers sup ON sup.id = po.supplier_id
       WHERE poi.product_id = $1
         AND po.status IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED')
       ORDER BY po.created_at ASC`,
      [productId],
    );

    // Units that arrived broken / not as ordered, per supplier.
    const issueRows: Array<{ supplierId: string; reason: string; quantity: string }> =
      await this.dataSource.query(
        `SELECT po.supplier_id AS "supplierId", gi.reason AS reason,
                SUM(gi.quantity) AS quantity
         FROM goods_receipt_issues gi
         JOIN purchase_order_items poi ON poi.id = gi.purchase_order_item_id
         JOIN goods_receipts gr ON gr.id = gi.goods_receipt_id
         JOIN purchase_orders po ON po.id = gr.purchase_order_id
         WHERE poi.product_id = $1 AND gi.reason IN ('DAMAGED', 'WRONG_ITEM')
         GROUP BY po.supplier_id, gi.reason`,
        [productId],
      );
    // Average delivery rating per supplier (orders that include this product).
    const ratingRows: Array<{ supplierId: string; avg: string; count: string }> =
      await this.dataSource.query(
        `SELECT po.supplier_id AS "supplierId", AVG(gr.rating) AS avg,
                COUNT(gr.rating) AS count
         FROM goods_receipts gr
         JOIN purchase_orders po ON po.id = gr.purchase_order_id
         WHERE gr.rating IS NOT NULL
           AND EXISTS (SELECT 1 FROM purchase_order_items poi
                        WHERE poi.purchase_order_id = po.id AND poi.product_id = $1)
         GROUP BY po.supplier_id`,
        [productId],
      );
    const ratingOf = (supplierId: string) => {
      const row = ratingRows.find((r) => r.supplierId === supplierId);
      return {
        averageRating: row ? Math.round(Number(row.avg) * 10) / 10 : null,
        ratingCount: row ? Number(row.count) : 0,
      };
    };
    const issueQty = (supplierId: string, reason: string) =>
      r3(
        issueRows
          .filter((r) => r.supplierId === supplierId && r.reason === reason)
          .reduce((sum, r) => sum + Number(r.quantity), 0),
      );

    type Agg = {
      supplierId: string;
      code: string;
      name: string;
      orders: Set<string>;
      lines: Array<{ price: number; quantity: number; at: Date }>;
      received: number;
      // Only finished orders (received / closed) tell how complete deliveries are.
      finishedOrdered: number;
      finishedReceived: number;
      leadDays: Map<string, number>;
    };
    const bySupplier = new Map<string, Agg>();
    for (const r of rows) {
      const agg: Agg = bySupplier.get(r.supplierId) ?? {
        supplierId: r.supplierId,
        code: r.supplierCode,
        name: r.supplierName,
        orders: new Set<string>(),
        lines: [],
        received: 0,
        finishedOrdered: 0,
        finishedReceived: 0,
        leadDays: new Map<string, number>(),
      };
      agg.orders.add(r.poId);
      agg.lines.push({
        price: Number(r.unitPrice),
        quantity: Number(r.quantity),
        at: new Date(r.createdAt),
      });
      agg.received += Number(r.receivedQuantity);
      if (r.status === 'RECEIVED' || r.status === 'CLOSED') {
        agg.finishedOrdered += Number(r.quantity);
        agg.finishedReceived += Number(r.receivedQuantity);
      }
      if (r.firstReceiptAt && !agg.leadDays.has(r.poId)) {
        const from = new Date(r.approvedAt ?? r.createdAt).getTime();
        const days = (new Date(r.firstReceiptAt).getTime() - from) / 86_400_000;
        agg.leadDays.set(r.poId, Math.max(days, 0));
      }
      bySupplier.set(r.supplierId, agg);
    }

    type SupplierRecommendation = {
      supplierId: string;
      code: string;
      name: string;
      isDefault: boolean;
      timesOrdered: number;
      totalQuantity: number;
      totalReceived: number;
      damagedQuantity: number;
      wrongQuantity: number;
      averageRating: number | null;
      ratingCount: number;
      lastPrice: number;
      lowestPrice: number;
      averagePrice: number;
      lastOrderedAt: Date | null;
      averageLeadDays: number | null;
      fillRate: number | null;
    };

    const suppliers: SupplierRecommendation[] = [...bySupplier.values()].map((a) => {
      const prices = a.lines.map((l) => l.price);
      const totalQty = a.lines.reduce((sum, l) => sum + l.quantity, 0);
      const weighted =
        totalQty > 0
          ? a.lines.reduce((sum, l) => sum + l.price * l.quantity, 0) / totalQty
          : prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const last = a.lines.reduce((x, y) => (y.at >= x.at ? y : x));
      const leads = [...a.leadDays.values()];
      return {
        supplierId: a.supplierId,
        code: a.code,
        name: a.name,
        isDefault: a.supplierId === product.supplierId,
        timesOrdered: a.orders.size,
        totalQuantity: r3(totalQty),
        totalReceived: r3(a.received),
        // % of the ordered quantity that arrived, over finished orders (null = none finished).
        fillRate:
          a.finishedOrdered > 0
            ? Math.round((a.finishedReceived / a.finishedOrdered) * 1000) / 10
            : (null as number | null),
        damagedQuantity: issueQty(a.supplierId, 'DAMAGED'),
        wrongQuantity: issueQty(a.supplierId, 'WRONG_ITEM'),
        ...ratingOf(a.supplierId),
        lastPrice: r2(last.price),
        lowestPrice: r2(Math.min(...prices)),
        averagePrice: r2(weighted),
        lastOrderedAt: last.at as Date | null,
        // Days from approval to the first delivery (only orders that arrived).
        averageLeadDays: leads.length
          ? Math.round((leads.reduce((s, d) => s + d, 0) / leads.length) * 10) / 10
          : null,
      };
    });

    // The product's usual supplier is always an option, with or without history.
    if (product.supplierId && !bySupplier.has(product.supplierId)) {
      const sup = await manager.findOne(Supplier, {
        where: { id: product.supplierId, isActive: true },
      });
      if (sup) {
        suppliers.push({
          supplierId: sup.id,
          code: sup.code,
          name: sup.name,
          isDefault: true,
          timesOrdered: 0,
          totalQuantity: 0,
          totalReceived: 0,
          damagedQuantity: 0,
          wrongQuantity: 0,
          fillRate: null as number | null,
          averageRating: null as number | null,
          ratingCount: 0,
          lastPrice: r2(Number(product.costPrice ?? 0)),
          lowestPrice: r2(Number(product.costPrice ?? 0)),
          averagePrice: r2(Number(product.costPrice ?? 0)),
          lastOrderedAt: null,
          averageLeadDays: null,
        });
      }
    }

    // Most experience first, then the cheapest.
    suppliers.sort(
      (a, b) => b.timesOrdered - a.timesOrdered || a.lastPrice - b.lastPrice,
    );

    return {
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        unit: product.unit,
        image: product.image,
        costPrice: Number(product.costPrice ?? 0),
      },
      suppliers,
    };
  }

  async submit(id: string, userId: string, approverId?: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertCreator(po, userId);
      this.assertStatus(po, [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.REJECTED,
      ]);
      await this.assertRoom(
        manager,
        po.warehouseId,
        id,
        await this.outstanding(manager, id),
      );
      po.rejectionReason = null;
      po.approvedById = null;
      po.approvedAt = null;
      await this.routeForApproval(manager, po, userId, approverId);
      await manager.save(PurchaseOrder, po);
    });
    return this.findOne(id);
  }

  async approve(id: string, userId: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertStatus(po, [PurchaseOrderStatus.SUBMITTED]);
      this.assertNotCreator(po, userId);
      await this.assertRequestedApprover(manager, po, userId);
      // Stock may have grown since it was submitted: check again.
      await this.assertRoom(
        manager,
        po.warehouseId,
        id,
        await this.outstanding(manager, id),
      );
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
      await this.assertRequestedApprover(manager, po, userId);
      po.status = PurchaseOrderStatus.REJECTED;
      po.approvedById = userId; // who made the decision
      po.approvedAt = new Date();
      po.rejectionReason = reason.trim();
      await manager.save(PurchaseOrder, po);
    });
    return this.findOne(id);
  }

  // --------------------------------------------------------------- receiving

  /** Goods receiving: records one delivery and puts the quantities that arrived into the purchase order's warehouse. */
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

      // What was short and why: a record only. Each is within what is still
      // to come on the line, after what arrives now.
      const issues = dto.issues ?? [];
      for (const issue of issues) {
        const item = byId.get(issue.itemId);
        if (!item) {
          throw new BadRequestException(
            'An item does not belong to this purchase order',
          );
        }
        const arrivingNow = Number(
          dto.items.find((l) => l.itemId === issue.itemId)?.quantity ?? 0,
        );
        const left = r3(
          Number(item.quantity) - Number(item.receivedQuantity) - arrivingNow,
        );
        if (r3(issue.quantity) > left) {
          throw new BadRequestException(
            `Cannot record ${issue.quantity} as short: only ${Math.max(left, 0)} is missing on this item`,
          );
        }
      }

      // What arrives must fit: stock now + this delivery, within the limit.
      // (Other open orders are not counted: this one is the goods at the door.)
      const arriving = r3(
        dto.items.reduce((sum, line) => sum + Number(line.quantity), 0),
      );
      const load = await loadWarehouse(manager, po.warehouseId, id);
      if (load && load.capacity !== null) {
        assertFits({ ...load, incoming: 0 }, arriving);
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
          rating: dto.rating ?? null,
        }),
      );

      for (const issue of issues) {
        await manager.save(
          GoodsReceiptIssue,
          manager.create(GoodsReceiptIssue, {
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: issue.itemId,
            reason: issue.reason as ReceiptIssueReason,
            quantity: r3(issue.quantity),
          }),
        );
      }

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

        // A new-product line is not in the catalogue yet: the product is
        // created now, with the quantity that arrived as its stock. Later
        // deliveries of the same line go into that product's stock as usual.
        if (!item.productId) {
          const category = item.newProductCategoryId
            ? await manager.findOne(Category, {
                where: { id: item.newProductCategoryId },
              })
            : null;
          const warehouse = await manager.findOne(Warehouse, {
            where: { id: po.warehouseId },
          });
          const brand = item.newProductBrandId
            ? await manager.findOne(Brand, {
                where: { id: item.newProductBrandId },
              })
            : null;
          // The order's supplier becomes the new product's usual supplier.
          const supplier = await manager.findOne(Supplier, {
            where: { id: po.supplierId },
          });
          if (!category || !warehouse) {
            throw new BadRequestException(
              `"${item.newProductName}": category or warehouse no longer exists`,
            );
          }

          const created = await this.products.createForPurchaseOrder(manager, {
            name: item.newProductName ?? '',
            categoryCode: category.code,
            brandCode: brand?.code ?? null,
            supplierCode: supplier?.code ?? null,
            unit: item.newProductUnit || 'PCS',
            sku: item.newProductSku,
            costPrice: Number(item.unitPrice),
            warehouseCode: warehouse.code,
            quantity,
            location: line.location?.trim() || null,
          });

          await manager.save(
            StockAdjustment,
            manager.create(StockAdjustment, {
              requestId: null,
              adjustedById: userId,
              productId: created.id,
              variantId: null,
              warehouseId: po.warehouseId,
              adjustmentType: 'INCREASE',
              quantity,
              reason: `Goods receipt ${receiptNumber} (${po.poNumber}) - new product`,
            }),
          );

          item.productId = created.id;
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
          // Where it was put away this time (optional): keep the old place otherwise.
          if (line.location?.trim()) stock.location = line.location.trim();
          await manager.save(Stock, stock);
        } else {
          await manager.save(
            Stock,
            manager.create(Stock, {
              productId,
              variantId: item.variantId,
              warehouseId: po.warehouseId,
              quantity,
              location: line.location?.trim() || null,
            }),
          );
        }

        // Automatically allocate received stock to waiting customer orders (FIFO)
        if (this.customerOrdersService) {
          await this.customerOrdersService.allocateWaitingStock(
            manager,
            productId,
            item.variantId ?? null,
            po.warehouseId,
            quantity,
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
        : dto.closeAfter
          ? PurchaseOrderStatus.CLOSED
          : PurchaseOrderStatus.PARTIALLY_RECEIVED;
      await manager.save(PurchaseOrder, po);
    });

    return this.findOne(id);
  }

  /**
   * Closes an order whose rest is not coming (or that was never delivered).
   * Stock already received stays; what is still to come no longer counts as
   * "on order" for the warehouse.
   */
  async close(id: string) {
    await this.dataSource.transaction(async (manager) => {
      const po = await this.lock(manager, id);
      this.assertStatus(po, [
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
      ]);
      po.status = PurchaseOrderStatus.CLOSED;
      await manager.save(PurchaseOrder, po);
    });
    return this.findOne(id);
  }

  /**
   * What was really bought from a supplier: one row per product on its
   * approved / received orders, with how often and the latest price.
   */
  async supplierProducts(supplierCode: string) {
    const rows: Array<{
      productId: string;
      orders: string;
      quantity: string;
      lastOrderedAt: Date;
      lastPrice: string;
    }> = await this.dataSource.query(
      `SELECT poi.product_id AS "productId",
              COUNT(DISTINCT po.id) AS orders,
              SUM(poi.quantity) AS quantity,
              MAX(po.created_at) AS "lastOrderedAt",
              (ARRAY_AGG(poi.unit_price ORDER BY po.created_at DESC))[1] AS "lastPrice"
         FROM purchase_order_items poi
         JOIN purchase_orders po ON po.id = poi.purchase_order_id
         JOIN suppliers s ON s.id = po.supplier_id
        WHERE s.code = $1
          AND poi.product_id IS NOT NULL
          AND po.status IN ('APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED')
        GROUP BY poi.product_id`,
      [supplierCode.trim()],
    );
    return rows.map((r) => ({
      productId: r.productId,
      orders: Number(r.orders),
      quantity: Number(r.quantity),
      lastOrderedAt: r.lastOrderedAt,
      lastPrice: Number(r.lastPrice),
    }));
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
      .leftJoinAndSelect('createdBy.profile', 'createdByProfile')
      .leftJoinAndSelect('po.requestedApprover', 'approver')
      .leftJoinAndSelect('approver.profile', 'approverProfile');

    if (query.status) {
      qb.andWhere('po.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('po.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('po.createdAt < :to', { to: new Date(query.to) });
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
      approver: this.person(po.requestedApprover),
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
        requestedApprover: { profile: true },
        items: {
          product: true,
          variant: true,
          newProductCategory: true,
          newProductBrand: true,
        },
        receipts: {
          receivedBy: { profile: true },
          items: { purchaseOrderItem: { product: true, variant: true } },
          issues: { purchaseOrderItem: { product: true, variant: true } },
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
              brandCode: item.newProductBrand?.code ?? null,
              brandName: item.newProductBrand?.name ?? null,
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
        rating: receipt.rating,
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
        // What was short in this delivery, and why.
        issues: (receipt.issues ?? []).map((issue) => ({
          productName:
            issue.purchaseOrderItem.product?.name ??
            issue.purchaseOrderItem.newProductName ??
            '',
          variantName: issue.purchaseOrderItem.variant?.name ?? null,
          reason: issue.reason,
          quantity: Number(issue.quantity),
        })),
      }));

    // How full the warehouse gets with this order (only while it is still to come).
    const stillToCome = [
      PurchaseOrderStatus.DRAFT,
      PurchaseOrderStatus.REJECTED,
      PurchaseOrderStatus.SUBMITTED,
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ].includes(po.status);
    let capacityInfo: ReturnType<typeof evaluateCapacity> | null = null;
    if (stillToCome) {
      const load = await loadWarehouse(
        this.dataSource.manager,
        po.warehouseId,
        po.id,
      );
      if (load) {
        capacityInfo = evaluateCapacity(
          load,
          r3(items.reduce((sum, i) => sum + i.remainingQuantity, 0)),
        );
      }
    }

    return {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      note: po.note,
      totalAmount: Number(po.totalAmount),
      rejectionReason: po.rejectionReason,
      capacityInfo,
      supplier: { code: po.supplier.code, name: po.supplier.name },
      warehouse: { code: po.warehouse.code, name: po.warehouse.name },
      createdBy: this.person(po.createdBy),
      // Who the order was sent to for approval (null = approved automatically).
      approver: this.person(po.requestedApprover),
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

        let brandId: string | null = null;
        if (np.brandCode?.trim()) {
          const brand = await manager.findOne(Brand, {
            where: { code: np.brandCode.trim().toUpperCase(), isActive: true },
          });
          if (!brand) {
            throw new NotFoundException(`${label}: brand not found or inactive`);
          }
          brandId = brand.id;
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
          newProductBrandId: brandId,
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
        newProductBrandId: null,
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

  /** Units of this order that have not arrived yet. */
  private async outstanding(manager: EntityManager, poId: string) {
    const [row]: Array<{ n: string }> = await manager.query(
      `SELECT COALESCE(SUM(GREATEST(quantity - received_quantity, 0)), 0) AS n
         FROM purchase_order_items WHERE purchase_order_id = $1`,
      [poId],
    );
    return Number(row?.n ?? 0);
  }

  /** Rejects the order when the warehouse could not hold it (with what is already on order). */
  private async assertRoom(
    manager: EntityManager,
    warehouseId: string,
    poId: string | null,
    quantity: number,
  ) {
    const load = await loadWarehouse(manager, warehouseId, poId);
    if (load && load.capacity !== null) assertFits(load, r3(quantity));
  }

  /**
   * Live check for the order form: how full [warehouseCode] gets if
   * [quantity] more units are ordered. [excludeId] is the order being edited.
   */
  async capacityPreview(
    warehouseCode: string,
    quantity: number,
    excludeId?: string,
  ) {
    const warehouse = await this.dataSource.manager.findOne(Warehouse, {
      where: { code: warehouseCode.trim().toUpperCase(), isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse "${warehouseCode}" not found`);
    }
    const load = await loadWarehouse(
      this.dataSource.manager,
      warehouse.id,
      excludeId ?? null,
    );
    return {
      warehouse: { code: warehouse.code, name: warehouse.name },
      ...evaluateCapacity(load!, r3(Number.isFinite(quantity) ? quantity : 0)),
    };
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

  /** What the user may do: Super Admin, or a role holding PO_APPROVE. */
  private async accessOf(manager: EntityManager, userId: string) {
    const userRoles = await manager.find(UserRole, {
      where: { userId },
      relations: { role: { rolePermissions: { permission: true } } },
    });
    const isSuperAdmin = userRoles.some((ur) => ur.role.name === 'SUPER_ADMIN');
    const permissions = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.name);
      }
    }
    return {
      isSuperAdmin,
      isAdmin: userRoles.some((ur) => ur.role.name === 'ADMIN'),
      canApprove: isSuperAdmin || permissions.has('PO_APPROVE'),
    };
  }

  /** Roles whose holders may approve an order created by someone with this access. */
  private approverRolesFor(me: { isSuperAdmin: boolean; isAdmin: boolean }) {
    if (me.isSuperAdmin) return [];
    // Admin -> Super Admin only. Manager (anyone else) -> Admin or Super Admin.
    return me.isAdmin ? ['SUPER_ADMIN'] : ['SUPER_ADMIN', 'ADMIN'];
  }

  /**
   * Sends the order for approval. Super Admin: approved on the spot, no
   * request. Admin: must name a Super Admin. Anyone else (Manager): must name
   * an Admin or a Super Admin. The chosen person then approves or rejects it.
   */
  private async routeForApproval(
    manager: EntityManager,
    po: PurchaseOrder,
    userId: string,
    approverId?: string,
  ) {
    const me = await this.accessOf(manager, userId);
    if (me.isSuperAdmin) {
      po.status = PurchaseOrderStatus.APPROVED;
      po.requestedApproverId = null;
      po.approvedById = userId;
      po.approvedAt = new Date();
      po.rejectionReason = null;
      return;
    }

    if (!approverId) {
      throw new BadRequestException(
        'Choose who should approve this purchase order',
      );
    }
    if (approverId === userId) {
      throw new BadRequestException(
        'You cannot send a purchase order to yourself for approval',
      );
    }
    const approver = await manager.findOne(User, {
      where: { id: approverId, status: UserStatus.ACTIVE },
    });
    if (!approver) {
      throw new NotFoundException('Approver not found or inactive');
    }
    const target = await this.accessOf(manager, approverId);
    if (!target.canApprove) {
      throw new BadRequestException(
        'This user is not allowed to approve purchase orders',
      );
    }
    const allowedRoles = this.approverRolesFor(me);
    const targetOk =
      (target.isSuperAdmin && allowedRoles.includes('SUPER_ADMIN')) ||
      (target.isAdmin && allowedRoles.includes('ADMIN'));
    if (!targetOk) {
      throw new BadRequestException(
        me.isAdmin
          ? 'An Admin must send purchase orders to a Super Admin for approval'
          : 'Purchase orders must be sent to an Admin or a Super Admin for approval',
      );
    }

    po.status = PurchaseOrderStatus.SUBMITTED;
    po.requestedApproverId = approverId;
    po.approvedById = null;
    po.approvedAt = null;
    po.rejectionReason = null;
  }

  /** An order sent to one person is decided by that person (or a Super Admin). */
  private async assertRequestedApprover(
    manager: EntityManager,
    po: PurchaseOrder,
    userId: string,
  ) {
    if (!po.requestedApproverId || po.requestedApproverId === userId) return;
    if ((await this.accessOf(manager, userId)).isSuperAdmin) return;
    throw new ForbiddenException(
      'This purchase order was sent to another approver',
    );
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
