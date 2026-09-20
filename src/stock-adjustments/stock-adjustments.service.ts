import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as XLSX from 'xlsx-js-style';

import { StockAdjustment } from './entities/stock-adjustment.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
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
  ) {}

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

        // 1. Validate Product
        if (!item.productCode?.trim()) {
          throw new BadRequestException(`${rowLabel}: productCode is required`);
        }

        const product = await manager.findOne(Product, {
          where: { code: item.productCode.trim(), isActive: true },
        });

        if (!product) {
          throw new NotFoundException(
            `${rowLabel}: Product with code "${item.productCode}" not found or inactive`,
          );
        }

        // 2. Validate Variant (if specified)
        let variant: ProductVariant | null = null;
        if (item.variantCode?.trim()) {
          variant = await manager.findOne(ProductVariant, {
            where: {
              code: item.variantCode.trim(),
              productId: product.id,
              isActive: true,
            },
          });

          if (!variant) {
            throw new NotFoundException(
              `${rowLabel}: Variant with code "${item.variantCode}" not found or inactive for product "${product.code}"`,
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
          const upperType = String(item.adjustmentType).trim().toUpperCase();
          if (
            upperType !== StockAdjustmentType.INCREASE &&
            upperType !== StockAdjustmentType.DECREASE
          ) {
            throw new BadRequestException(
              `${rowLabel}: adjustmentType must be INCREASE or DECREASE`,
            );
          }
          resolvedType = upperType as StockAdjustmentType;
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
          // INCREASE
          if (stock) {
            newStock = previousStock + absoluteQty;
            stock.quantity = newStock;
            await manager.save(Stock, stock);
          } else {
            newStock = absoluteQty;
            const newStockEntity = manager.create(Stock, {
              productId: product.id,
              variantId: variant ? variant.id : null,
              warehouseId: warehouse.id,
              quantity: newStock,
            });
            stock = await manager.save(Stock, newStockEntity);
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
    const { skip, page, limit } = getPaginationOptions(query);

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
