import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx-js-style';
import { PRODUCT_DIRECT_IMPORT_COLUMNS } from './constants/product-import-template.constant';

export interface ProductDirectCreateBatchItem {
  product: {
    productCode: string;
    productName: string;
    description?: string | null;
    categoryCode: string;
    brandCode?: string | null;
    supplierCode?: string | null;
    hasVariants: boolean;
    unit: string;
    productSku: string;
    productBarcode?: string | null;
    productCostPrice?: number | null;
    productSellingPrice?: number | null;
    minimumStock?: number | null;
    maximumStock?: number | null;
  };
  variants: Array<{
    variantCode: string;
    variantName: string;
    variantSku: string;
    variantBarcode?: string | null;
    variantAttributes?: Record<string, string> | null;
    variantCostPrice?: number | null;
    variantSellingPrice?: number | null;
  }>;
  stock: Array<{
    productCode: string;
    variantCode?: string | null;
    warehouseCode: string;
    quantity: number;
  }>;
}

@Injectable()
export class ProductsExcelService {
  /**
   * Generates a styled Excel template for direct product creation.
   */
  generateTemplate(): Buffer {
    const columns = PRODUCT_DIRECT_IMPORT_COLUMNS;

    const data: any[][] = [
      ['Stock Management'],
      [],
      ['Request Type', 'PRODUCT_CREATE'],
      [],
      columns,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    worksheet['!cols'] = columns.map((col) => ({
      wch: Math.max(col.length + 4, 18),
    }));

    // Merge title
    worksheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: columns.length - 1 },
      },
    ];

    // Title styling
    worksheet['A1'].s = {
      font: { bold: true, sz: 16, color: { rgb: '1B365D' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    // Label styling
    worksheet['A3'].s = {
      font: { bold: true },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
    worksheet['B3'].s = {
      font: { bold: true, color: { rgb: '0066CC' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };

    // Header styling
    const headerRowIndex = 4;
    columns.forEach((_, colIndex) => {
      const address = XLSX.utils.encode_cell({
        r: headerRowIndex,
        c: colIndex,
      });

      worksheet[address].s = {
        font: { bold: true, sz: 11, color: { rgb: '002060' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9EAF7' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
    });

    // Empty bordered entry rows (clean template without sample data)
    const startDataRow = 5;
    const endDataRow = 24;
    for (let row = startDataRow; row <= endDataRow; row++) {
      for (let col = 0; col < columns.length; col++) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        worksheet[address] = {
          t: 's',
          v: '',
          s: {
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            },
          },
        };
      }
    }

    worksheet['!rows'] = [
      { hpt: 28 },
      { hpt: 15 },
      { hpt: 20 },
      { hpt: 10 },
      { hpt: 25 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Import');

    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
  }

  /**
   * Parses an uploaded Excel file and converts it into grouped ProductDirectCreateBatchItem objects.
   */
  importExcel(file: Express.Multer.File): ProductDirectCreateBatchItem[] {
    if (!file || !file.buffer) {
      throw new BadRequestException('Excel file is required');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Excel file contains no sheets');
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false,
    }) as unknown[][];

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    // Find the header row (contains 'product_code')
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const candidateRow = rawRows[i];
      if (
        Array.isArray(candidateRow) &&
        candidateRow.some((cell) =>
          String(cell ?? '')
            .trim()
            .toLowerCase()
            .includes('product_code'),
        )
      ) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException(
        'Could not find header row containing "product_code"',
      );
    }

    const rawHeaders = rawRows[headerRowIndex] as unknown[];
    const headers = rawHeaders.map((h) =>
      String(h ?? '')
        .trim()
        .toLowerCase(),
    );

    // Validate required headers
    const requiredHeaders = [
      'product_code',
      'product_name',
      'category_code',
      'unit',
      'product_sku',
    ];
    for (const reqHeader of requiredHeaders) {
      if (!headers.includes(reqHeader)) {
        throw new BadRequestException(
          `Missing required header column: "${reqHeader}"`,
        );
      }
    }

    // Process data rows
    const dataRows = rawRows
      .slice(headerRowIndex + 1)
      .map((row, idx) => ({
        rowNumber: headerRowIndex + 1 + idx + 1,
        values: row as unknown[],
      }))
      .filter(({ values }) =>
        values.some(
          (val) =>
            val !== null && val !== undefined && String(val).trim() !== '',
        ),
      );

    if (dataRows.length === 0) {
      throw new BadRequestException(
        'Excel file contains no data rows to import',
      );
    }

    // Convert row arrays to objects
    const rowObjects: Record<string, any>[] = [];
    for (const { rowNumber, values } of dataRows) {
      const obj: Record<string, any> = { __rowNumber: rowNumber };
      headers.forEach((header, colIndex) => {
        if (header) {
          obj[header] = values[colIndex] ?? null;
        }
      });

      // Filter out guide rows if product_code is empty
      if (
        obj.product_code === null ||
        obj.product_code === undefined ||
        String(obj.product_code).trim() === ''
      ) {
        continue;
      }

      rowObjects.push(obj);
    }

    if (rowObjects.length === 0) {
      throw new BadRequestException(
        'No valid product rows found in Excel sheet',
      );
    }

    // Validate each row
    for (const row of rowObjects) {
      const rNum = row.__rowNumber;
      this.requiredString(row, 'product_code', rNum);
      this.requiredString(row, 'product_name', rNum);
      this.requiredString(row, 'category_code', rNum);
      this.requiredString(row, 'unit', rNum);
      this.requiredString(row, 'product_sku', rNum);

      const hasVariants = this.booleanValue(row, 'has_variants', rNum);
      if (hasVariants) {
        this.requiredString(row, 'variant_code', rNum);
        this.requiredString(row, 'variant_sku', rNum);
      }

      if (row.warehouse_code && String(row.warehouse_code).trim() !== '') {
        this.positiveNumber(row, 'quantity', rNum);
      }
    }

    // Group rows by product_code
    const productGroups = new Map<string, Record<string, any>[]>();
    for (const row of rowObjects) {
      const code = String(row.product_code).trim();
      if (!productGroups.has(code)) {
        productGroups.set(code, []);
      }
      productGroups.get(code)!.push(row);
    }

    // Build batch payload
    const batchItems: ProductDirectCreateBatchItem[] = [];

    for (const [productCode, rows] of productGroups.entries()) {
      const first = rows[0];
      const hasVariants = this.booleanValue(
        first,
        'has_variants',
        first.__rowNumber,
      );

      const product = {
        productCode,
        productName: String(first.product_name).trim(),
        description: this.optionalString(first.description),
        categoryCode: String(first.category_code).trim(),
        brandCode: this.optionalString(first.brand_code),
        supplierCode: this.optionalString(first.supplier_code),
        hasVariants,
        unit: String(first.unit).trim(),
        productSku: String(first.product_sku).trim(),
        productBarcode: this.optionalString(first.product_barcode),
        productCostPrice:
          this.optionalNonNegativeNumber(
            first,
            'base_price',
            first.__rowNumber,
          ) ??
          this.optionalNonNegativeNumber(
            first,
            'product_cost_price',
            first.__rowNumber,
          ) ??
          this.optionalNonNegativeNumber(
            first,
            'cost_price',
            first.__rowNumber,
          ),
        productSellingPrice:
          this.optionalNonNegativeNumber(
            first,
            'selling_price',
            first.__rowNumber,
          ) ??
          this.optionalNonNegativeNumber(
            first,
            'product_selling_price',
            first.__rowNumber,
          ),
        minimumStock: this.optionalNonNegativeNumber(
          first,
          'minimum_stock',
          first.__rowNumber,
        ),
        maximumStock: this.optionalNonNegativeNumber(
          first,
          'maximum_stock',
          first.__rowNumber,
        ),
      };

      // Extract variants
      const variants: ProductDirectCreateBatchItem['variants'] = [];
      const seenVariantCodes = new Set<string>();

      if (hasVariants) {
        for (const row of rows) {
          const vCode = this.optionalString(row.variant_code);
          if (vCode && !seenVariantCodes.has(vCode)) {
            seenVariantCodes.add(vCode);
            variants.push({
              variantCode: vCode,
              variantName:
                this.optionalString(row.variant_name) ??
                `${product.productName} (${vCode})`,
              variantSku: this.requiredString(
                row,
                'variant_sku',
                row.__rowNumber,
              ),
              variantBarcode: this.optionalString(row.variant_barcode),
              variantAttributes: this.parseAttributes(row.variant_attributes),
              variantCostPrice:
                this.optionalNonNegativeNumber(
                  row,
                  'variant_base_price',
                  row.__rowNumber,
                ) ??
                this.optionalNonNegativeNumber(
                  row,
                  'variant_cost_price',
                  row.__rowNumber,
                ) ??
                this.optionalNonNegativeNumber(
                  row,
                  'base_price',
                  row.__rowNumber,
                ) ??
                this.optionalNonNegativeNumber(
                  row,
                  'cost_price',
                  row.__rowNumber,
                ),
              variantSellingPrice:
                this.optionalNonNegativeNumber(
                  row,
                  'variant_selling_price',
                  row.__rowNumber,
                ) ??
                this.optionalNonNegativeNumber(
                  row,
                  'selling_price',
                  row.__rowNumber,
                ) ??
                this.optionalNonNegativeNumber(
                  row,
                  'product_selling_price',
                  row.__rowNumber,
                ),
            });
          }
        }

        if (variants.length === 0) {
          throw new BadRequestException(
            `Product "${productCode}" has has_variants=TRUE but no variant rows were provided`,
          );
        }
      }

      // Extract stock
      const stock: ProductDirectCreateBatchItem['stock'] = [];
      const seenStockKeys = new Set<string>();

      for (const row of rows) {
        const whCode = this.optionalString(row.warehouse_code);
        const qty = this.optionalNonNegativeNumber(
          row,
          'quantity',
          row.__rowNumber,
        );

        if (whCode && qty !== null && qty > 0) {
          const vCode = this.optionalString(row.variant_code);
          const key = `${whCode}_${vCode ?? ''}`;

          if (!seenStockKeys.has(key)) {
            seenStockKeys.add(key);
            stock.push({
              productCode,
              variantCode: vCode,
              warehouseCode: whCode,
              quantity: qty,
            });
          }
        }
      }

      batchItems.push({
        product,
        variants,
        stock,
      });
    }

    return batchItems;
  }

  /**
   * Exports an array of existing products to an Excel buffer.
   */
  exportExcel(products: any[]): Buffer {
    const columns = PRODUCT_DIRECT_IMPORT_COLUMNS;
    const dataRows: any[][] = [];

    for (const prod of products) {
      const baseProductCols = [
        prod.code,
        prod.name,
        prod.description ?? '',
        prod.category?.code ?? '',
        prod.brand?.code ?? '',
        prod.supplier?.code ?? '',
        prod.hasVariants ? 'TRUE' : 'FALSE',
        prod.unit,
        prod.sku,
        prod.barcode ?? '',
        Number(prod.costPrice ?? 0),
        Number(prod.sellingPrice ?? 0),
        Number(prod.minimumStock ?? 0),
        prod.maximumStock !== null ? Number(prod.maximumStock) : '',
      ];

      if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
        for (const variant of prod.variants) {
          const variantAttrs = variant.attributes
            ? Object.entries(variant.attributes)
                .map(([k, v]) => `${k}=${v}`)
                .join(';')
            : '';

          // Match first stock if any
          const vStock = prod.stocks?.find(
            (s: any) =>
              s.variantId === variant.id || s.variant?.id === variant.id,
          );

          dataRows.push([
            ...baseProductCols,
            variant.code,
            variant.name,
            variant.sku,
            variant.barcode ?? '',
            variantAttrs,
            variant.costPrice !== null ? Number(variant.costPrice) : '',
            variant.sellingPrice !== null ? Number(variant.sellingPrice) : '',
            vStock?.warehouse?.code ?? '',
            vStock ? Number(vStock.quantity) : '',
          ]);
        }
      } else {
        const pStock = prod.stocks?.[0];
        dataRows.push([
          ...baseProductCols,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          pStock?.warehouse?.code ?? '',
          pStock ? Number(pStock.quantity) : '',
        ]);
      }
    }

    const data: any[][] = [
      ['Stock Management - Exported Products Catalog'],
      [],
      ['Export Date', new Date().toISOString()],
      [],
      columns,
      ...dataRows,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    worksheet['!cols'] = columns.map((col) => ({
      wch: Math.max(col.length + 4, 18),
    }));

    worksheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: columns.length - 1 },
      },
    ];

    worksheet['A1'].s = {
      font: { bold: true, sz: 16, color: { rgb: '1B365D' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    const headerRowIndex = 4;
    columns.forEach((_, colIndex) => {
      const address = XLSX.utils.encode_cell({
        r: headerRowIndex,
        c: colIndex,
      });

      worksheet[address].s = {
        font: { bold: true, sz: 11, color: { rgb: '002060' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9EAF7' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
  }

  // =====================================================
  // ROW PARSING HELPERS
  // =====================================================

  private requiredString(
    row: Record<string, unknown>,
    field: string,
    rowNumber: unknown,
  ): string {
    const value = row[field];
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new BadRequestException(
        `Field "${field}" is required at row ${rowNumber}`,
      );
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
        `Field "${field}" must be greater than 0 at row ${rowNumber}`,
      );
    }
    return value;
  }

  private optionalNonNegativeNumber(
    row: Record<string, unknown>,
    field: string,
    rowNumber: unknown,
  ): number | null {
    const value = row[field];
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      throw new BadRequestException(
        `Field "${field}" must be >= 0 at row ${rowNumber}`,
      );
    }
    return num;
  }

  private booleanValue(
    row: Record<string, unknown>,
    field: string,
    rowNumber: unknown,
  ): boolean {
    const val = String(row[field] ?? '')
      .trim()
      .toUpperCase();

    if (val === 'TRUE' || val === '1' || val === 'YES') {
      return true;
    }
    if (val === 'FALSE' || val === '0' || val === 'NO' || val === '') {
      return false;
    }

    throw new BadRequestException(
      `Field "${field}" must be TRUE or FALSE at row ${rowNumber} (got "${val}")`,
    );
  }

  private parseAttributes(value: unknown): Record<string, string> | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    const str = String(value).trim();
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        return JSON.parse(str);
      } catch {
        // Fall back to key=value parsing
      }
    }

    const result: Record<string, string> = {};
    const pairs = str.split(';');

    for (const pair of pairs) {
      if (!pair.trim()) continue;
      const [key, val] = pair.split('=');
      if (!key || val === undefined) {
        throw new BadRequestException(
          `Invalid variant_attributes format: "${value}". Expected "Key=Value;Key2=Value2"`,
        );
      }
      result[key.trim()] = val.trim();
    }

    return Object.keys(result).length > 0 ? result : null;
  }
}
