import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as XLSX from 'xlsx-js-style';

import { StockAdjustment } from './entities/stock-adjustment.entity';
import { StockTransfer } from './entities/stock-transfer.entity';
import { CreateStockTransferItemDto } from './dto/create-stock-transfer.dto';
import { Stock } from '../stock/entities/stock.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { CustomerOrdersService } from '../customer-orders/customer-orders.service';
import {
  CreateStockAdjustmentItemDto,
  StockAdjustmentType,
} from './dto/create-stock-adjustment.dto';
import { StockAdjustmentQueryDto } from './dto/stock-adjustment-query.dto';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginatedResult,
} from '../common/pagination';
import { assertFits, loadWarehouse } from '../warehouses/warehouse-capacity';

@Injectable()
export class StockAdjustmentsService {
  constructor(
    @InjectRepository(StockAdjustment)
    private readonly adjustmentRepo: Repository<StockAdjustment>,

    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,

    private readonly dataSource: DataSource,
    @Optional()
    @Inject(forwardRef(() => CustomerOrdersService))
    private readonly customerOrdersService?: CustomerOrdersService,
  ) {}

  /** Moves stock from one warehouse to another straight away (STOCK_TRANSFER: Super Admin, Admin, Manager). */
  async transferDirect(items: CreateStockTransferItemDto[], userId?: string) {
    if (!items || items.length === 0) {
      throw new BadRequestException('No stock transfer items provided');
    }
    const isUuid = (v: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    return this.dataSource.transaction(async (manager) => {
      const results: Array<{
        transferId: string;
        productCode: string;
        variantCode: string | null;
        fromWarehouseCode: string;
        toWarehouseCode: string;
        quantity: number;
      }> = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = `Item ${i + 1} (${item.productCode || 'unknown'})`;
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException(`${label}: quantity must be above 0`);
        }
        if (item.fromWarehouseCode.trim() === item.toWarehouseCode.trim()) {
          throw new BadRequestException(
            `${label}: from and to warehouse cannot be the same`,
          );
        }

        const productVal = item.productCode.trim();
        const productWhere: any[] = [
          { code: productVal, isActive: true },
          { barcode: productVal, isActive: true },
          { sku: productVal, isActive: true },
        ];
        if (isUuid(productVal)) {
          productWhere.unshift({ id: productVal, isActive: true });
        }
        const product = await manager.findOne(Product, { where: productWhere });
        if (!product) {
          throw new NotFoundException(
            `${label}: product "${item.productCode}" not found or inactive`,
          );
        }

        let variant: ProductVariant | null = null;
        if (item.variantCode?.trim()) {
          const v = item.variantCode.trim();
          const variantWhere: any[] = [
            { code: v, productId: product.id, isActive: true },
            { barcode: v, productId: product.id, isActive: true },
            { sku: v, productId: product.id, isActive: true },
          ];
          if (isUuid(v)) {
            variantWhere.unshift({
              id: v,
              productId: product.id,
              isActive: true,
            });
          }
          variant = await manager.findOne(ProductVariant, {
            where: variantWhere,
          });
          if (!variant) {
            throw new NotFoundException(
              `${label}: variant "${item.variantCode}" not found for product "${product.code}"`,
            );
          }
        }

        const fromWarehouse = await manager.findOne(Warehouse, {
          where: { code: item.fromWarehouseCode.trim(), isActive: true },
        });
        if (!fromWarehouse) {
          throw new NotFoundException(
            `${label}: source warehouse "${item.fromWarehouseCode}" not found or inactive`,
          );
        }
        const toWarehouse = await manager.findOne(Warehouse, {
          where: { code: item.toWarehouseCode.trim(), isActive: true },
        });
        if (!toWarehouse) {
          throw new NotFoundException(
            `${label}: destination warehouse "${item.toWarehouseCode}" not found or inactive`,
          );
        }

        // Source: must hold enough.
        const source = await manager.findOne(Stock, {
          where: {
            productId: product.id,
            variantId: variant ? variant.id : IsNull(),
            warehouseId: fromWarehouse.id,
          },
        });
        if (!source) {
          throw new BadRequestException(
            `${label}: no stock of "${product.code}" in warehouse "${fromWarehouse.code}"`,
          );
        }
        const available = Number(source.quantity);
        if (available < quantity) {
          throw new BadRequestException(
            `${label}: insufficient stock in "${fromWarehouse.code}". Available: ${available}, requested: ${quantity}`,
          );
        }

        // Destination: the units must fit.
        const load = await loadWarehouse(manager, toWarehouse.id);
        if (load && load.capacity !== null) {
          assertFits({ ...load, incoming: 0 }, quantity);
        }

        source.quantity = available - quantity;
        await manager.save(Stock, source);

        let target = await manager.findOne(Stock, {
          where: {
            productId: product.id,
            variantId: variant ? variant.id : IsNull(),
            warehouseId: toWarehouse.id,
          },
        });
        if (target) {
          target.quantity = Number(target.quantity) + quantity;
        } else {
          target = manager.create(Stock, {
            productId: product.id,
            variantId: variant ? variant.id : null,
            warehouseId: toWarehouse.id,
            quantity,
          });
        }
        await manager.save(Stock, target);

        const saved = await manager.save(
          StockTransfer,
          manager.create(StockTransfer, {
            transferredById: userId ?? null,
            productId: product.id,
            variantId: variant ? variant.id : null,
            fromWarehouseId: fromWarehouse.id,
            toWarehouseId: toWarehouse.id,
            quantity,
            reason: item.reason?.trim() || null,
          }),
        );

        results.push({
          transferId: saved.id,
          productCode: product.code,
          variantCode: variant ? variant.code : null,
          fromWarehouseCode: fromWarehouse.code,
          toWarehouseCode: toWarehouse.code,
          quantity,
        });
      }

      return {
        message: 'Stock transferred successfully',
        count: results.length,
        data: results,
      };
    });
  }

  /**
   * Directly adjust stock balances (ADMIN and SUPER_ADMIN only).
   * Runs in an atomic transaction and records audit trail into stock_adjustments.
   */
  async adjustDirect(
    items: CreateStockAdjustmentItemDto[],
    userId?: string,
  ): Promise<{
    message: string;
    count: number;
    data: Array<{
      adjustmentId: string;
      productCode: string;
      variantCode?: string | null;
      warehouseCode: string;
      adjustmentType: StockAdjustmentType;
      quantity: number;
      previousStock: number;
      newStock: number;
      reason: string;
    }>;
  }> {
    if (!items || items.length === 0) {
      throw new BadRequestException('No stock adjustment items provided');
    }

    return this.dataSource.transaction(async (manager) => {
      const results: Array<{
        adjustmentId: string;
        productCode: string;
        variantCode?: string | null;
        warehouseCode: string;
        adjustmentType: StockAdjustmentType;
        quantity: number;
        previousStock: number;
        newStock: number;
        reason: string;
      }> = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowLabel = `Item ${i + 1} (${item.productCode || 'unknown'})`;

        // 1. Validate Product (matches code, barcode, SKU, or UUID)
        if (!item.productCode?.trim()) {
          throw new BadRequestException(`${rowLabel}: productCode is required`);
        }

        const productVal = item.productCode.trim();
        const isProductUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            productVal,
          );
        const productWhere: any[] = [
          { code: productVal, isActive: true },
          { barcode: productVal, isActive: true },
          { sku: productVal, isActive: true },
        ];
        if (isProductUuid) {
          productWhere.unshift({ id: productVal, isActive: true });
        }

        const product = await manager.findOne(Product, {
          where: productWhere,
        });

        if (!product) {
          throw new NotFoundException(
            `${rowLabel}: Product with code, barcode, SKU or ID "${item.productCode}" not found or inactive`,
          );
        }

        // 2. Validate Variant (if specified - matches code, barcode, SKU, or UUID)
        let variant: ProductVariant | null = null;
        if (item.variantCode?.trim()) {
          const variantVal = item.variantCode.trim();
          const isVariantUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              variantVal,
            );
          const variantWhere: any[] = [
            { code: variantVal, productId: product.id, isActive: true },
            { barcode: variantVal, productId: product.id, isActive: true },
            { sku: variantVal, productId: product.id, isActive: true },
          ];
          if (isVariantUuid) {
            variantWhere.unshift({
              id: variantVal,
              productId: product.id,
              isActive: true,
            });
          }

          variant = await manager.findOne(ProductVariant, {
            where: variantWhere,
          });

          if (!variant) {
            throw new NotFoundException(
              `${rowLabel}: Variant with code, barcode, SKU or ID "${item.variantCode}" not found or inactive for product "${product.code}"`,
            );
          }
        }

        // 3. Validate Warehouse
        if (!item.warehouseCode?.trim()) {
          throw new BadRequestException(
            `${rowLabel}: warehouseCode is required`,
          );
        }

        const warehouse = await manager.findOne(Warehouse, {
          where: { code: item.warehouseCode.trim(), isActive: true },
        });

        if (!warehouse) {
          throw new NotFoundException(
            `${rowLabel}: Warehouse with code "${item.warehouseCode}" not found or inactive`,
          );
        }

        // 4. Determine Adjustment Type and Absolute Quantity (Option 3 Flexible)
        if (item.quantity === undefined || item.quantity === null) {
          throw new BadRequestException(`${rowLabel}: quantity is required`);
        }

        const numQty = Number(item.quantity);
        if (!Number.isFinite(numQty) || numQty === 0) {
          throw new BadRequestException(
            `${rowLabel}: quantity must be a non-zero number`,
          );
        }

        let resolvedType: StockAdjustmentType;
        let absoluteQty: number;

        if (item.adjustmentType) {
          const upperType = String(item.adjustmentType)
            .trim()
            .toUpperCase() as StockAdjustmentType;
          if (
            upperType !== StockAdjustmentType.INCREASE &&
            upperType !== StockAdjustmentType.DECREASE
          ) {
            throw new BadRequestException(
              `${rowLabel}: adjustmentType must be INCREASE or DECREASE`,
            );
          }
          resolvedType = upperType;
          absoluteQty = Math.abs(numQty);
        } else {
          // Infer from sign
          resolvedType =
            numQty < 0
              ? StockAdjustmentType.DECREASE
              : StockAdjustmentType.INCREASE;
          absoluteQty = Math.abs(numQty);
        }

        if (!item.reason?.trim()) {
          throw new BadRequestException(`${rowLabel}: reason is required`);
        }

        // 5. Find Current Stock
        const stockWhere: any = {
          productId: product.id,
          warehouseId: warehouse.id,
          variantId: variant ? variant.id : IsNull(),
        };

        let stock = await manager.findOne(Stock, { where: stockWhere });
        const previousStock = stock ? Number(stock.quantity) : 0;
        let newStock = previousStock;

        // 6. Apply Adjustment
        if (resolvedType === StockAdjustmentType.DECREASE) {
          if (!stock) {
            throw new BadRequestException(
              `${rowLabel}: Stock not found for product "${product.code}" in warehouse "${warehouse.code}". Cannot decrease.`,
            );
          }

          if (previousStock < absoluteQty) {
            throw new BadRequestException(
              `${rowLabel}: Insufficient stock for product "${product.code}". Current stock: ${previousStock}, requested decrease: ${absoluteQty}`,
            );
          }

          newStock = previousStock - absoluteQty;
          stock.quantity = newStock;
          await manager.save(Stock, stock);
        } else {
          // INCREASE: the units must fit in the warehouse.
          const load = await loadWarehouse(manager, warehouse.id);
          if (load && load.capacity !== null) {
            assertFits({ ...load, incoming: 0 }, absoluteQty);
          }
          if (stock) {
            newStock = previousStock + absoluteQty;
            stock.quantity = newStock;
            if (item.location?.trim()) stock.location = item.location.trim();
            await manager.save(Stock, stock);
          } else {
            newStock = absoluteQty;
            const newStockEntity = manager.create(Stock, {
              productId: product.id,
              variantId: variant ? variant.id : null,
              warehouseId: warehouse.id,
              quantity: newStock,
              location: item.location?.trim() || null,
            });
            stock = await manager.save(Stock, newStockEntity);
          }

          // Automatically allocate incoming stock to waiting customer orders (FIFO)
          if (this.customerOrdersService) {
            await this.customerOrdersService.allocateWaitingStock(
              manager,
              product.id,
              variant ? variant.id : null,
              warehouse.id,
              absoluteQty,
            );
          }
        }

        // 7. Record History in stock_adjustments
        const adjustment = manager.create(StockAdjustment, {
          requestId: null,
          adjustedById: userId ?? null,
          productId: product.id,
          variantId: variant ? variant.id : null,
          warehouseId: warehouse.id,
          adjustmentType: resolvedType,
          movementType:
            item.movementType === 'IN' && resolvedType === 'INCREASE'
              ? 'IN'
              : item.movementType === 'OUT' && resolvedType === 'DECREASE'
                ? 'OUT'
                : null,
          quantity: absoluteQty,
          reason: item.reason.trim(),
        });

        const savedAdjustment = await manager.save(StockAdjustment, adjustment);

        results.push({
          adjustmentId: savedAdjustment.id,
          productCode: product.code,
          variantCode: variant ? variant.code : null,
          warehouseCode: warehouse.code,
          adjustmentType: resolvedType,
          quantity: absoluteQty,
          previousStock,
          newStock,
          reason: item.reason.trim(),
        });
      }

      return {
        message: 'Stock adjustments applied successfully',
        count: results.length,
        data: results,
      };
    });
  }

  /**
   * Import direct stock adjustments from an Excel file.
   * Supports Option 3 (Both / Flexible: explicit adjustment_type or +/- quantity sign).
   */
  async importExcel(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<{
    message: string;
    count: number;
    data: any[];
  }> {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    const ext = file.originalname?.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      throw new BadRequestException(
        'Invalid file type. Only Excel files (.xlsx, .xls) are allowed.',
      );
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Workbook contains no sheets');
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException('Excel sheet is empty');
    }

    // Locate header row
    let headerRowIndex = 4;
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      const row = rawRows[i] || [];
      const normalized = row.map((c) => this.normalizeColumn(c));
      if (
        normalized.includes('product_code') &&
        normalized.includes('warehouse_code')
      ) {
        headerRowIndex = i;
        break;
      }
    }

    const headerRow = rawRows[headerRowIndex] || [];
    const headers = headerRow.map((c) => this.normalizeColumn(c));

    const requiredColumns = [
      'product_code',
      'warehouse_code',
      'quantity',
      'reason',
    ];
    const missing = requiredColumns.filter((col) => !headers.includes(col));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required Excel columns: ${missing.join(', ')}`,
      );
    }

    const items: CreateStockAdjustmentItemDto[] = [];

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (
        !row ||
        row.every(
          (c) => c === null || c === undefined || String(c).trim() === '',
        )
      ) {
        continue;
      }

      const rowObj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = row[idx];
      });

      const rawProductCode = rowObj['product_code'];
      const rawWarehouseCode = rowObj['warehouse_code'];
      const rawQuantity = rowObj['quantity'];
      const rawReason = rowObj['reason'];
      const rawAdjType = rowObj['adjustment_type'];
      const rawVariantCode = rowObj['variant_code'];

      if (!rawProductCode) continue;

      const itemDto: CreateStockAdjustmentItemDto = {
        productCode: String(rawProductCode).trim(),
        variantCode: rawVariantCode ? String(rawVariantCode).trim() : null,
        warehouseCode: String(rawWarehouseCode).trim(),
        adjustmentType: rawAdjType
          ? (String(rawAdjType).trim().toUpperCase() as StockAdjustmentType)
          : undefined,
        quantity: Number(rawQuantity),
        reason: rawReason
          ? String(rawReason).trim()
          : 'Excel direct adjustment',
      };

      items.push(itemDto);
    }

    if (items.length === 0) {
      throw new BadRequestException(
        'No valid adjustment rows found in Excel sheet',
      );
    }

    return this.adjustDirect(items, userId);
  }

  /**
   * Generates a styled Excel template for direct stock adjustments.
   */
  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    const titleRows = [
      ['Stock Management System'],
      [],
      ['Template Type: Direct Stock Adjustment'],
      [],
    ];

    const headers = [
      'product_code',
      'variant_code',
      'warehouse_code',
      'adjustment_type',
      'quantity',
      'reason',
      'base_price',
      'selling_price',
    ];

    const sampleRows = [
      [
        'IPHONE-16-PRO',
        'IP16P-BLK-128',
        'WH001',
        'INCREASE',
        5,
        'Direct inventory recount surplus',
        850,
        1099,
      ],
      [
        'IPHONE-16-PRO',
        'IP16P-BLK-128',
        'WH001',
        'DECREASE',
        2,
        'Damaged packaging deduction',
        850,
        1099,
      ],
      [
        'AIRPODS-PRO-2',
        '',
        'WH001',
        '',
        -3,
        'Lost units (inferred DECREASE via negative quantity)',
        180,
        249,
      ],
      [
        'AIRPODS-PRO-2',
        '',
        'WH001',
        '',
        10,
        'Audit surplus (inferred INCREASE via positive quantity)',
        180,
        249,
      ],
    ];

    const emptyRows = Array.from({ length: 15 }, () =>
      Array(headers.length).fill(''),
    );

    const aoa = [...titleRows, headers, ...sampleRows, ...emptyRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Styling
    const borderStyle = {
      top: { style: 'thin', color: { rgb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
      left: { style: 'thin', color: { rgb: 'CCCCCC' } },
      right: { style: 'thin', color: { rgb: 'CCCCCC' } },
    };

    const headerStyle = {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '002060' } },
      fill: { fgColor: { rgb: 'D9EAF7' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderStyle,
    };

    const sampleStyle = {
      font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '555555' } },
      fill: { fgColor: { rgb: 'F9F9F9' } },
      alignment: { vertical: 'center' },
      border: borderStyle,
    };

    const emptyStyle = {
      font: { name: 'Arial', sz: 10 },
      alignment: { vertical: 'center' },
      border: borderStyle,
    };

    // Apply header styles (row 5)
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 4, c });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }

    // Apply sample row styles (rows 6 to 9)
    for (let r = 5; r < 5 + sampleRows.length; r++) {
      for (let c = 0; c < headers.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) ws[cellRef].s = sampleStyle;
      }
    }

    // Apply empty row styles
    for (let r = 5 + sampleRows.length; r < aoa.length; r++) {
      for (let c = 0; c < headers.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
        ws[cellRef].s = emptyStyle;
      }
    }

    // Column widths
    ws['!cols'] = [
      { wch: 18 }, // product_code
      { wch: 18 }, // variant_code
      { wch: 18 }, // warehouse_code
      { wch: 18 }, // adjustment_type
      { wch: 12 }, // quantity
      { wch: 45 }, // reason
      { wch: 14 }, // base_price
      { wch: 14 }, // selling_price
    ];

    ws['!rows'] = [
      { hpt: 28 },
      { hpt: 10 },
      { hpt: 20 },
      { hpt: 10 },
      { hpt: 26 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Stock Adjustment');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Paginated listing of adjustment audit history.
   */
  async findAll(
    query?: StockAdjustmentQueryDto,
  ): Promise<PaginatedResult<StockAdjustment>> {
    const { skip, limit } = getPaginationOptions(query);

    const qb = this.adjustmentRepo
      .createQueryBuilder('sa')
      .leftJoinAndSelect('sa.product', 'product')
      .leftJoinAndSelect('sa.variant', 'variant')
      .leftJoinAndSelect('sa.warehouse', 'warehouse')
      .leftJoinAndSelect('sa.adjustedBy', 'adjustedBy')
      .leftJoinAndSelect('sa.request', 'request')
      .orderBy('sa.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query?.productId) {
      qb.andWhere('sa.productId = :productId', {
        productId: query.productId,
      });
    }

    if (query?.warehouseId) {
      qb.andWhere('sa.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }

    if (query?.adjustmentType) {
      qb.andWhere('sa.adjustmentType = :adjustmentType', {
        adjustmentType: query.adjustmentType,
      });
    }

    if (query?.productCode) {
      qb.andWhere('product.code ILIKE :productCode', {
        productCode: `%${query.productCode}%`,
      });
    }

    if (query?.warehouseCode) {
      qb.andWhere('warehouse.code ILIKE :warehouseCode', {
        warehouseCode: `%${query.warehouseCode}%`,
      });
    }

    if (query?.search) {
      qb.andWhere(
        '(sa.reason ILIKE :search OR product.code ILIKE :search OR warehouse.code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return createPaginatedResult(data, total, query);
  }

  /** Stock movement timeline: stock_adjustments plus approved Stock In/Out/Transfer requests, newest first. */
  async history(opts: {
    kind?: string;
    productId?: string;
    /** When set, only what this user did (their own adjustments and requests). */
    userId?: string;
    /** ISO timestamps: only movements with from <= at < to. Either can be left out. */
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const toDate = (value: string | undefined, name: string) => {
      if (!value?.trim()) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`${name} must be a valid date`);
      }
      return date.toISOString();
    };
    const from = toDate(opts.from, 'from');
    const to = toDate(opts.to, 'to');
    const kinds = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'];
    const kind =
      opts.kind && kinds.includes(opts.kind.toUpperCase())
        ? opts.kind.toUpperCase()
        : null;
    const productId = opts.productId?.trim() || null;
    if (
      productId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        productId,
      )
    ) {
      throw new BadRequestException('productId must be a UUID');
    }
    const limit = Math.min(
      Math.max(Number.isFinite(opts.limit) ? Number(opts.limit) : 20, 1),
      100,
    );
    const page = Math.max(
      Number.isFinite(opts.page) ? Number(opts.page) : 1,
      1,
    );

    const base = `
      WITH h AS (
        SELECT sa.id::text AS id,
               COALESCE(sa.movement_type, 'ADJUSTMENT') AS kind,
               sa.created_at AS at,
               p.id AS product_id,
               p.code AS product_code,
               p.name AS product_name,
               v.name AS variant_name,
               CASE WHEN sa.adjustment_type = 'DECREASE' THEN w.name END AS from_warehouse,
               CASE WHEN sa.adjustment_type = 'INCREASE' THEN w.name END AS to_warehouse,
               sa.quantity::float8 AS quantity,
               sa.reason AS reason,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', up.first_name, up.last_name)), ''), u.staff_id) AS by_staff,
               u.staff_id AS by_staff_id,
               r.request_no AS request_no,
               COALESCE(sa.adjusted_by_id, r.requester_id) AS owner_id
        FROM stock_adjustments sa
        JOIN products p ON p.id = sa.product_id
        JOIN warehouses w ON w.id = sa.warehouse_id
        LEFT JOIN product_variants v ON v.id = sa.variant_id
        LEFT JOIN users u ON u.id = sa.adjusted_by_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN requests r ON r.id = sa.request_id

        UNION ALL

        SELECT st.id::text AS id,
               'TRANSFER' AS kind,
               st.created_at AS at,
               p.id AS product_id,
               p.code AS product_code,
               p.name AS product_name,
               v.name AS variant_name,
               fw.name AS from_warehouse,
               tw.name AS to_warehouse,
               st.quantity::float8 AS quantity,
               st.reason AS reason,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', up.first_name, up.last_name)), ''), u.staff_id) AS by_staff,
               u.staff_id AS by_staff_id,
               NULL::text AS request_no,
               st.transferred_by_id AS owner_id
        FROM stock_transfers st
        JOIN products p ON p.id = st.product_id
        JOIN warehouses fw ON fw.id = st.from_warehouse_id
        JOIN warehouses tw ON tw.id = st.to_warehouse_id
        LEFT JOIN product_variants v ON v.id = st.variant_id
        LEFT JOIN users u ON u.id = st.transferred_by_id
        LEFT JOIN user_profiles up ON up.user_id = u.id

        UNION ALL

        SELECT ri.id::text AS id,
               CASE r.request_type WHEN 'STOCK_IN' THEN 'IN'
                                   WHEN 'STOCK_OUT' THEN 'OUT'
                                   ELSE 'TRANSFER' END AS kind,
               r.updated_at AS at,
               p.id AS product_id,
               ri.product_code AS product_code,
               ri.product_name AS product_name,
               ri.variant_name AS variant_name,
               CASE r.request_type WHEN 'STOCK_OUT' THEN w.name
                                   WHEN 'STOCK_TRANSFER' THEN fw.name END AS from_warehouse,
               CASE r.request_type WHEN 'STOCK_IN' THEN w.name
                                   WHEN 'STOCK_TRANSFER' THEN tw.name END AS to_warehouse,
               ri.quantity::float8 AS quantity,
               COALESCE(NULLIF(TRIM(ri.adjustment_reason), ''), r.remark) AS reason,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', up.first_name, up.last_name)), ''), u.staff_id) AS by_staff,
               u.staff_id AS by_staff_id,
               r.request_no AS request_no,
               r.requester_id AS owner_id
        FROM request_items ri
        JOIN requests r ON r.id = ri.request_id
        LEFT JOIN products p ON p.code = ri.product_code
        LEFT JOIN warehouses w ON w.code = ri.warehouse_code
        LEFT JOIN warehouses fw ON fw.code = ri.from_warehouse_code
        LEFT JOIN warehouses tw ON tw.code = ri.to_warehouse_code
        LEFT JOIN users u ON u.id = r.requester_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE r.status = 'APPROVED'
          AND r.request_type IN ('STOCK_IN', 'STOCK_OUT', 'STOCK_TRANSFER')
      )`;
    const where = `WHERE ($1::text IS NULL OR h.kind = $1)
                     AND ($2::uuid IS NULL OR h.product_id = $2::uuid)
                     AND ($3::uuid IS NULL OR h.owner_id = $3::uuid)
                     AND ($4::timestamptz IS NULL OR h.at >= $4::timestamptz)
                     AND ($5::timestamptz IS NULL OR h.at < $5::timestamptz)`;
    const ownerId = opts.userId ?? null;

    const [rows, counted] = await Promise.all([
      this.dataSource.query(
        `${base}
         SELECT * FROM h ${where}
         ORDER BY h.at DESC, h.id
         LIMIT $6 OFFSET $7`,
        [kind, productId, ownerId, from, to, limit, (page - 1) * limit],
      ),
      this.dataSource.query(
        `${base} SELECT COUNT(*)::int AS total FROM h ${where}`,
        [kind, productId, ownerId, from, to],
      ),
    ]);
    const total = Number(counted?.[0]?.total ?? 0);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        kind: r.kind,
        at: r.at,
        productId: r.product_id,
        productCode: r.product_code,
        productName: r.product_name,
        variantName: r.variant_name,
        fromWarehouse: r.from_warehouse,
        toWarehouse: r.to_warehouse,
        quantity: Number(r.quantity),
        reason: r.reason,
        byStaff: r.by_staff,
        byStaffId: r.by_staff_id,
        requestNo: r.request_no,
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  /**
   * Single adjustment details by UUID.
   */
  async findOne(id: string): Promise<StockAdjustment> {
    const adjustment = await this.adjustmentRepo.findOne({
      where: { id },
      relations: {
        product: true,
        variant: true,
        warehouse: true,
        adjustedBy: true,
        request: true,
      },
    });

    if (!adjustment) {
      throw new NotFoundException(`Stock adjustment with ID "${id}" not found`);
    }

    return adjustment;
  }

  private normalizeColumn(col: any): string {
    const c = String(col || '')
      .trim()
      .toLowerCase();
    if (c === 'cost_price' || c === 'product_cost_price') return 'base_price';
    if (c === 'product_selling_price') return 'selling_price';
    if (c === 'adjustment_type' || c === 'type') return 'adjustment_type';
    return c;
  }
}
