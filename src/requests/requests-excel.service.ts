import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx-js-style';

import { RequestType } from './enum/request-type.enum';
import { AdjustmentType } from './enum/adjustment-type';
import { CreateRequestDto } from './dto/create-request.dto';
import { REQUEST_IMPORT_COLUMNS } from './constants/request-import-template';

@Injectable()
export class RequestsExcelService {
  // =====================================================
  // IMPORT EXCEL
  // =====================================================

  importExcel(
    file: Express.Multer.File,
    requestType: RequestType,
  ): CreateRequestDto {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }

    // ---------------------------------------------------
    // READ WORKBOOK
    // ---------------------------------------------------

    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new BadRequestException('Excel file does not contain a worksheet');
    }

    const worksheet = workbook.Sheets[sheetName];

    // ---------------------------------------------------
    // READ ROWS
    // ---------------------------------------------------

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false,
    }) as unknown[][];

    // ---------------------------------------------------
    // CHECK REQUEST TYPE
    // ---------------------------------------------------

    const excelRequestType = rows[2]?.[1];

    if (excelRequestType !== requestType) {
      throw new BadRequestException(
        `Request type mismatch. Excel: ${excelRequestType}, API: ${requestType}`,
      );
    }

    // ---------------------------------------------------
    // EXPECTED COLUMNS
    // ---------------------------------------------------

    const expectedColumns = REQUEST_IMPORT_COLUMNS[requestType];

    if (!expectedColumns) {
      throw new BadRequestException(`Unsupported request type: ${requestType}`);
    }

    // ---------------------------------------------------
    // HEADER ROW
    // ---------------------------------------------------

    const headers = (rows[4] ?? []).map((header) =>
      String(header ?? '')
        .trim()
        .toLowerCase(),
    );

    this.validateColumns(headers, expectedColumns, requestType);

    // ---------------------------------------------------
    // DATA ROWS
    // ---------------------------------------------------

    const dataRows = rows
      .slice(5)
      .filter((row) =>
        row.some(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== '',
        ),
      );

    if (dataRows.length === 0) {
      throw new BadRequestException('Excel file does not contain data rows');
    }

    // ---------------------------------------------------
    // ROW → OBJECT
    // ---------------------------------------------------

    const objects = dataRows.map((row, index) => {
      const rowNumber = index + 6;

      return this.rowToObject(headers, row, rowNumber);
    });

    // ---------------------------------------------------
    // VALIDATE DATA
    // ---------------------------------------------------

    this.validateRows(objects, requestType);

    // ---------------------------------------------------
    // BUILD DTO
    // ---------------------------------------------------

    return this.buildRequestDto(objects, requestType);
  }

  // =====================================================
  // COLUMN VALIDATION
  // =====================================================

  private normalizeColumnName(col: string): string {
    const c = col.trim().toLowerCase();
    if (
      c === 'product_cost_price' ||
      c === 'cost_price' ||
      c === 'product_base_price'
    )
      return 'base_price';
    if (c === 'product_selling_price') return 'selling_price';
    if (c === 'variant_cost_price') return 'variant_base_price';
    if (c === 'adjustment_type' || c === 'type') return 'adjustment_type';
    return c;
  }

  private validateColumns(
    actual: string[],
    expected: string[],
    requestType?: RequestType,
  ): void {
    const normalizedActual = actual.map((c) => this.normalizeColumnName(c));
    const normalizedExpected = expected.map((c) => this.normalizeColumnName(c));

    let missing = normalizedExpected.filter(
      (column) => !normalizedActual.includes(column),
    );

    // Option 3: For STOCK_ADJUSTMENT, adjustment_type can be omitted and inferred from quantity sign.
    // Also allow base_price and selling_price to be omitted if not needed.
    if (requestType === RequestType.STOCK_ADJUSTMENT) {
      missing = missing.filter(
        (col) =>
          col !== 'adjustment_type' &&
          col !== 'base_price' &&
          col !== 'selling_price',
      );
    }

    const unexpected = normalizedActual.filter(
      (column) => !normalizedExpected.includes(column),
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing Excel columns: ${missing.join(', ')}`,
      );
    }

    if (unexpected.length > 0) {
      throw new BadRequestException(
        `Unexpected Excel columns: ${unexpected.join(', ')}`,
      );
    }
  }

  // =====================================================
  // ROW → OBJECT
  // =====================================================

  private rowToObject(
    headers: string[],
    row: unknown[],
    rowNumber: number,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      result[header] = row[index];
    });

    result.__rowNumber = rowNumber;

    return result;
  }

  // =====================================================
  // VALIDATE ROWS
  // =====================================================

  private validateRows(
    rows: Record<string, unknown>[],
    requestType: RequestType,
  ): void {
    switch (requestType) {
      case RequestType.PRODUCT_CREATE:
        this.validateProductCreate(rows);
        break;

      case RequestType.PRODUCT_UPDATE:
        this.validateProductUpdate(rows);
        break;

      case RequestType.VARIANT_CREATE:
        this.validateVariantCreate(rows);
        break;

      case RequestType.VARIANT_UPDATE:
        this.validateVariantUpdate(rows);
        break;

      case RequestType.STOCK_IN:
      case RequestType.STOCK_OUT:
        this.validateStock(rows);
        break;

      case RequestType.STOCK_TRANSFER:
        this.validateStockTransfer(rows);
        break;

      case RequestType.STOCK_ADJUSTMENT:
        this.validateStockAdjustment(rows);
        break;

      default:
        throw new BadRequestException(
          `Excel import is not implemented for ${requestType}`,
        );
    }
  }

  // =====================================================
  // PRODUCT CREATE VALIDATION
  // =====================================================

  private validateProductCreate(rows: Record<string, unknown>[]): void {
    const variantCodes = new Set<string>();

    rows.forEach((row) => {
      const rowNumber = row.__rowNumber;

      this.requiredString(row, 'product_code', rowNumber);
      this.requiredString(row, 'product_name', rowNumber);
      this.requiredString(row, 'category_code', rowNumber);
      this.requiredString(row, 'unit', rowNumber);
      this.requiredString(row, 'product_sku', rowNumber);

      const hasVariants = this.booleanValue(row, 'has_variants', rowNumber);

      if (hasVariants) {
        const variantCode = this.requiredString(row, 'variant_code', rowNumber);
        this.requiredString(row, 'variant_name', rowNumber);
        this.requiredString(row, 'variant_sku', rowNumber);

        if (variantCodes.has(variantCode)) {
          throw new BadRequestException(
            `Duplicate variant_code "${variantCode}" at row ${rowNumber}`,
          );
        }

        variantCodes.add(variantCode);
      }

      this.requiredString(row, 'warehouse_code', rowNumber);
      this.positiveNumber(row, 'quantity', rowNumber);

      // Validate prices (support base_price or cost_price)
      this.validateOptionalPrice(
        row,
        rowNumber,
        'base_price',
        'product_cost_price',
        'cost_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'selling_price',
        'product_selling_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'variant_base_price',
        'variant_cost_price',
      );
      this.validateOptionalPrice(row, rowNumber, 'variant_selling_price');
    });
  }

  // =====================================================
  // PRODUCT UPDATE VALIDATION
  // =====================================================

  private validateProductUpdate(rows: Record<string, unknown>[]): void {
    rows.forEach((row) => {
      const rowNumber = row.__rowNumber;
      this.requiredString(row, 'product_code', rowNumber);
      this.requiredString(row, 'product_name', rowNumber);
      this.requiredString(row, 'category_code', rowNumber);
      this.requiredString(row, 'unit', rowNumber);
      this.requiredString(row, 'product_sku', rowNumber);

      this.validateOptionalPrice(
        row,
        rowNumber,
        'base_price',
        'product_cost_price',
        'cost_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'selling_price',
        'product_selling_price',
      );
    });
  }

  // =====================================================
  // VARIANT CREATE VALIDATION
  // =====================================================

  private validateVariantCreate(rows: Record<string, unknown>[]): void {
    rows.forEach((row) => {
      const rowNumber = row.__rowNumber;
      this.requiredString(row, 'product_code', rowNumber);
      this.requiredString(row, 'variant_code', rowNumber);
      this.requiredString(row, 'variant_name', rowNumber);
      this.requiredString(row, 'variant_sku', rowNumber);
      this.requiredString(row, 'warehouse_code', rowNumber);
      this.positiveNumber(row, 'quantity', rowNumber);

      this.validateOptionalPrice(
        row,
        rowNumber,
        'base_price',
        'variant_cost_price',
        'variant_base_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'selling_price',
        'variant_selling_price',
      );
    });
  }

  // =====================================================
  // VARIANT UPDATE VALIDATION
  // =====================================================

  private validateVariantUpdate(rows: Record<string, unknown>[]): void {
    rows.forEach((row) => {
      const rowNumber = row.__rowNumber;
      this.requiredString(row, 'product_code', rowNumber);
      this.requiredString(row, 'variant_code', rowNumber);
      this.requiredString(row, 'variant_name', rowNumber);
      this.requiredString(row, 'variant_sku', rowNumber);

      this.validateOptionalPrice(
        row,
        rowNumber,
        'base_price',
        'variant_cost_price',
        'variant_base_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'selling_price',
        'variant_selling_price',
      );
    });
  }

  // =====================================================
  // STOCK VALIDATION (IN / OUT)
  // =====================================================

  private validateStock(rows: Record<string, unknown>[]): void {
    rows.forEach((row) => {
      const rowNumber = row.__rowNumber;

      this.requiredString(row, 'product_code', rowNumber);
      this.requiredString(row, 'warehouse_code', rowNumber);
      this.positiveNumber(row, 'quantity', rowNumber);

      this.validateOptionalPrice(
        row,
        rowNumber,
        'base_price',
        'cost_price',
        'product_cost_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'selling_price',
        'product_selling_price',
      );
    });
  }

  // =====================================================
  // TRANSFER VALIDATION
  // =====================================================

  private validateStockTransfer(rows: Record<string, unknown>[]): void {
    rows.forEach((row) => {
      const rowNumber = row.__rowNumber;

      this.requiredString(row, 'product_code', rowNumber);

      const from = this.requiredString(row, 'from_warehouse_code', rowNumber);
      const to = this.requiredString(row, 'to_warehouse_code', rowNumber);

      if (from === to) {
        throw new BadRequestException(
          `From and to warehouse cannot be the same at row ${rowNumber}`,
        );
      }

      this.positiveNumber(row, 'quantity', rowNumber);

      this.validateOptionalPrice(
        row,
        rowNumber,
        'base_price',
        'cost_price',
        'product_cost_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'selling_price',
        'product_selling_price',
      );
    });
  }

  // =====================================================
  // STOCK ADJUSTMENT VALIDATION
  // =====================================================

  private validateStockAdjustment(rows: Record<string, unknown>[]): void {
    rows.forEach((row) => {
      const rowNumber = row.__rowNumber;

      this.requiredString(row, 'product_code', rowNumber);
      this.requiredString(row, 'warehouse_code', rowNumber);
      this.requiredString(row, 'reason', rowNumber);

      // Validate quantity (supports signed quantities: -5 or 5)
      const rawQty = row.quantity;
      if (
        rawQty === null ||
        rawQty === undefined ||
        String(rawQty).trim() === ''
      ) {
        throw new BadRequestException(
          `Field "quantity" is required at row ${rowNumber}`,
        );
      }
      const numQty = Number(rawQty);
      if (!Number.isFinite(numQty) || numQty === 0) {
        throw new BadRequestException(
          `Field "quantity" must be a non-zero number at row ${rowNumber}`,
        );
      }

      // Validate adjustment_type if explicitly provided
      const rawAdjType = row.adjustment_type ?? row.type;
      if (
        rawAdjType !== null &&
        rawAdjType !== undefined &&
        String(rawAdjType).trim() !== ''
      ) {
        const normalized = String(rawAdjType).trim().toUpperCase();
        if (normalized !== 'INCREASE' && normalized !== 'DECREASE') {
          throw new BadRequestException(
            `Field "adjustment_type" at row ${rowNumber} must be either "INCREASE" or "DECREASE"`,
          );
        }
      }

      this.validateOptionalPrice(
        row,
        rowNumber,
        'base_price',
        'cost_price',
        'product_cost_price',
      );
      this.validateOptionalPrice(
        row,
        rowNumber,
        'selling_price',
        'product_selling_price',
      );
    });
  }

  // =====================================================
  // BUILD DTO
  // =====================================================

  private buildRequestDto(
    rows: Record<string, unknown>[],
    requestType: RequestType,
  ): CreateRequestDto {
    // ---------------------------------------------------
    // PRODUCT CREATE
    // ---------------------------------------------------

    if (requestType === RequestType.PRODUCT_CREATE) {
      const first = rows[0];

      const product = {
        productCode: String(first.product_code),
        productName: String(first.product_name),
        description: this.optionalString(first.description),
        categoryCode: String(first.category_code),
        brandCode: this.optionalString(first.brand_code),
        supplierCode: this.optionalString(first.supplier_code),
        hasVariants: this.booleanValue(
          first,
          'has_variants',
          first.__rowNumber,
        ),
        unit: String(first.unit),
        productSku: String(first.product_sku),
        productBarcode: this.optionalString(first.product_barcode),
        productCostPrice: this.optionalPrice(
          first,
          'base_price',
          'product_cost_price',
          'cost_price',
        ),
        productSellingPrice: this.optionalPrice(
          first,
          'selling_price',
          'product_selling_price',
        ),
        minimumStock: this.optionalNumber(first.minimum_stock),
        maximumStock: this.optionalNumber(first.maximum_stock),
      };

      const variants = rows
        .filter((row) => row.variant_code)
        .map((row) => ({
          variantCode: String(row.variant_code),
          variantName: String(row.variant_name),
          variantSku: String(row.variant_sku),
          variantBarcode: this.optionalString(row.variant_barcode),
          variantAttributes: this.parseAttributes(row.variant_attributes),
          variantCostPrice: this.optionalPrice(
            row,
            'variant_base_price',
            'variant_cost_price',
            'base_price',
            'cost_price',
          ),
          variantSellingPrice: this.optionalPrice(
            row,
            'variant_selling_price',
            'selling_price',
          ),
        }));

      const stock = rows.map((row) => ({
        productCode: String(row.product_code),
        variantCode: this.optionalString(row.variant_code),
        warehouseCode: String(row.warehouse_code),
        quantity: Number(row.quantity),
        basePrice: this.optionalPrice(
          row,
          'base_price',
          'variant_base_price',
          'product_cost_price',
          'cost_price',
        ),
        costPrice: this.optionalPrice(
          row,
          'base_price',
          'variant_base_price',
          'product_cost_price',
          'cost_price',
        ),
        sellingPrice: this.optionalPrice(
          row,
          'selling_price',
          'variant_selling_price',
          'product_selling_price',
        ),
      }));

      return {
        requestType,
        product,
        variants,
        stock,
      } as CreateRequestDto;
    }

    // ---------------------------------------------------
    // PRODUCT UPDATE
    // ---------------------------------------------------

    if (requestType === RequestType.PRODUCT_UPDATE) {
      const first = rows[0];

      const product = {
        productCode: String(first.product_code),
        productName: String(first.product_name),
        description: this.optionalString(first.description),
        categoryCode: String(first.category_code),
        brandCode: this.optionalString(first.brand_code),
        supplierCode: this.optionalString(first.supplier_code),
        unit: String(first.unit),
        productSku: String(first.product_sku),
        productBarcode: this.optionalString(first.product_barcode),
        productCostPrice: this.optionalPrice(
          first,
          'base_price',
          'product_cost_price',
          'cost_price',
        ),
        productSellingPrice: this.optionalPrice(
          first,
          'selling_price',
          'product_selling_price',
        ),
        minimumStock: this.optionalNumber(first.minimum_stock),
        maximumStock: this.optionalNumber(first.maximum_stock),
      };

      return {
        requestType,
        product,
      } as CreateRequestDto;
    }

    // ---------------------------------------------------
    // VARIANT CREATE / UPDATE
    // ---------------------------------------------------

    if (
      requestType === RequestType.VARIANT_CREATE ||
      requestType === RequestType.VARIANT_UPDATE
    ) {
      const variants = rows.map((row) => ({
        productCode: String(row.product_code),
        variantCode: String(row.variant_code),
        variantName: String(row.variant_name),
        variantSku: String(row.variant_sku),
        variantBarcode: this.optionalString(row.variant_barcode),
        variantAttributes: this.parseAttributes(row.variant_attributes),
        variantCostPrice: this.optionalPrice(
          row,
          'base_price',
          'variant_base_price',
          'variant_cost_price',
          'cost_price',
        ),
        variantSellingPrice: this.optionalPrice(
          row,
          'selling_price',
          'variant_selling_price',
        ),
      }));

      const stock = rows
        .filter((row) => row.warehouse_code)
        .map((row) => ({
          productCode: String(row.product_code),
          variantCode: String(row.variant_code),
          warehouseCode: String(row.warehouse_code),
          quantity: Number(row.quantity),
          basePrice: this.optionalPrice(
            row,
            'base_price',
            'variant_base_price',
            'variant_cost_price',
            'cost_price',
          ),
          costPrice: this.optionalPrice(
            row,
            'base_price',
            'variant_base_price',
            'variant_cost_price',
            'cost_price',
          ),
          sellingPrice: this.optionalPrice(
            row,
            'selling_price',
            'variant_selling_price',
          ),
        }));

      return {
        requestType,
        variants,
        stock: stock.length > 0 ? stock : undefined,
      } as CreateRequestDto;
    }

    // ---------------------------------------------------
    // STOCK ADJUSTMENT (Option 3: adjustment_type or quantity sign)
    // ---------------------------------------------------

    if (requestType === RequestType.STOCK_ADJUSTMENT) {
      const adjustments = rows.map((row) => {
        const rawAdjType = row.adjustment_type ?? row.type;
        const numQty = Number(row.quantity);

        let adjustmentType: AdjustmentType;
        if (
          rawAdjType !== null &&
          rawAdjType !== undefined &&
          String(rawAdjType).trim() !== ''
        ) {
          const upper = String(rawAdjType).trim().toUpperCase();
          adjustmentType =
            upper === 'DECREASE'
              ? AdjustmentType.DECREASE
              : AdjustmentType.INCREASE;
        } else {
          // Flexible Option 3: Infer from sign of quantity (-5 = DECREASE, 5 = INCREASE)
          adjustmentType =
            numQty < 0 ? AdjustmentType.DECREASE : AdjustmentType.INCREASE;
        }

        const quantity = Math.abs(numQty);

        return {
          productCode: String(row.product_code),
          variantCode: this.optionalString(row.variant_code),
          warehouseCode: String(row.warehouse_code),
          adjustmentType,
          quantity,
          reason: String(row.reason),
          basePrice: this.optionalPrice(
            row,
            'base_price',
            'cost_price',
            'product_cost_price',
          ),
          costPrice: this.optionalPrice(
            row,
            'base_price',
            'cost_price',
            'product_cost_price',
          ),
          sellingPrice: this.optionalPrice(
            row,
            'selling_price',
            'product_selling_price',
          ),
        };
      });

      return {
        requestType,
        adjustments,
      } as CreateRequestDto;
    }

    // ---------------------------------------------------
    // STOCK IN / OUT / TRANSFER
    // ---------------------------------------------------

    return {
      requestType,
      stock: rows.map((row) => ({
        productCode: String(row.product_code),
        variantCode: this.optionalString(row.variant_code),
        warehouseCode: this.optionalString(row.warehouse_code),
        quantity: Number(row.quantity),
        fromWarehouseCode: this.optionalString(row.from_warehouse_code),
        toWarehouseCode: this.optionalString(row.to_warehouse_code),
        reason: this.optionalString(row.reason),
        adjustmentReason: this.optionalString(row.reason),
        basePrice: this.optionalPrice(
          row,
          'base_price',
          'cost_price',
          'product_cost_price',
        ),
        costPrice: this.optionalPrice(
          row,
          'base_price',
          'cost_price',
          'product_cost_price',
        ),
        sellingPrice: this.optionalPrice(
          row,
          'selling_price',
          'product_selling_price',
        ),
      })),
    } as CreateRequestDto;
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private validateOptionalPrice(
    row: Record<string, unknown>,
    rowNumber: unknown,
    ...fields: string[]
  ): void {
    for (const field of fields) {
      const val = row[field];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        const num = Number(val);
        if (!Number.isFinite(num) || num < 0) {
          throw new BadRequestException(
            `${field} must be >= 0 at row ${rowNumber}`,
          );
        }
        return;
      }
    }
  }

  private optionalPrice(
    row: Record<string, unknown>,
    ...fields: string[]
  ): number | null {
    for (const field of fields) {
      const val = row[field];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        const num = Number(val);
        if (Number.isFinite(num) && num >= 0) {
          return num;
        }
      }
    }
    return null;
  }

  private requiredString(
    row: Record<string, unknown>,
    field: string,
    rowNumber: unknown,
  ): string {
    const value = row[field];

    if (value === null || value === undefined || String(value).trim() === '') {
      throw new BadRequestException(`${field} is required at row ${rowNumber}`);
    }

    return String(value).trim();
  }

  private optionalString(value: unknown): string | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    return String(value).trim();
  }

  private positiveNumber(
    row: Record<string, unknown>,
    field: string,
    rowNumber: unknown,
  ): number {
    const value = Number(row[field]);

    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(
        `${field} must be greater than 0 at row ${rowNumber}`,
      );
    }

    return value;
  }

  private optionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  private booleanValue(
    row: Record<string, unknown>,
    field: string,
    rowNumber: unknown,
  ): boolean {
    const value = String(row[field] ?? '')
      .trim()
      .toUpperCase();

    if (value === 'TRUE') {
      return true;
    }

    if (value === 'FALSE') {
      return false;
    }

    throw new BadRequestException(
      `${field} must be TRUE or FALSE at row ${rowNumber}`,
    );
  }

  private parseAttributes(value: unknown): Record<string, string> | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    const result: Record<string, string> = {};

    const pairs = String(value).split(';');

    for (const pair of pairs) {
      const [key, val] = pair.split('=');

      if (!key || val === undefined) {
        throw new BadRequestException(
          `Invalid variant_attributes format: ${value}`,
        );
      }

      result[key.trim()] = val.trim();
    }

    return result;
  }
}
