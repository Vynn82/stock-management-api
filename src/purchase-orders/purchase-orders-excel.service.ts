import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx-js-style';
import { PRODUCT_DIRECT_IMPORT_COLUMNS } from '../products/constants/product-import-template.constant';

export interface PurchaseOrderImportRow {
  /** Row number in the sheet (1-based), so errors can point at it. */
  row: number;
  productCode: string;
  variantCode: string | null;
  quantity: number | null;
  unitPrice: number | null;
  /** Only for a product that is not in the catalogue yet (product_code empty). */
  newProductName: string | null;
  categoryCode: string | null;
  unit: string | null;
  sku: string | null;
}

export const PO_IMPORT_MAX_ROWS = 500;

/** Real catalogue data, used to fill the template's sample rows and reference sheets. */
export interface PoTemplateReference {
  products: {
    code: string;
    name: string;
    sku: string;
    variants: { code: string; name: string; sku: string }[];
  }[];
  categories: { code: string; name: string }[];
}

/** Reads / writes the Excel (or CSV) used to fill a purchase order's products. */
@Injectable()
export class PurchaseOrdersExcelService {
  private static readonly HEADERS = [
    'product_code',
    'variant_code',
    'quantity',
    'unit_price',
    'new_product_name',
    'category_code',
    'unit',
    'sku',
  ];

  generateTemplate(ref?: PoTemplateReference): Buffer {
    const products = ref?.products ?? [];
    const categories = ref?.categories ?? [];
    const plain = products.find((p) => p.variants.length === 0);
    const withVariants = products.find((p) => p.variants.length > 0);

    // Sample rows use real codes from the database so the file imports as-is.
    const samples: any[][] = [];
    if (plain) samples.push([plain.code, '', 10, 5.5, '', '', '', '']);
    if (withVariants) {
      samples.push([withVariants.code, withVariants.variants[0].code, 20, '', '', '', '', '']);
    }
    if (categories.length) {
      samples.push(['', '', 30, 12, 'Sample new product (rename me)', categories[0].code, 'PCS', '']);
    }
    if (samples.length === 0) {
      samples.push(['PRD-0001', '', 10, 5.5, '', '', '', '']);
    }

    const rows: any[][] = [
      ['Stock Management System'],
      [],
      ['Template Type: Purchase Order products'],
      [
        'Existing product: product_code + quantity (variant_code only if it has variants; empty unit_price = cost price). ' +
          'New product: leave product_code empty and fill new_product_name + category_code (unit defaults to PCS, sku optional). ' +
          'See the "Products" and "Categories" sheets for valid codes.',
      ],
      PurchaseOrdersExcelService.HEADERS,
      ...samples,
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 18 }];
    sheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: '1B365D' } } };
    PurchaseOrdersExcelService.HEADERS.forEach((_, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: 4, c })];
      cell.s = {
        font: { bold: true, color: { rgb: '002060' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9EAF7' } },
        alignment: { horizontal: 'center' },
      };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'PO Products');

    if (products.length) {
      const productRows: any[][] = [['product_code', 'variant_code', 'name', 'sku']];
      for (const p of products) {
        if (p.variants.length === 0) {
          productRows.push([p.code, '', p.name, p.sku]);
        } else {
          for (const v of p.variants) {
            productRows.push([p.code, v.code, `${p.name} - ${v.name}`, v.sku]);
          }
        }
      }
      const ps = XLSX.utils.aoa_to_sheet(productRows);
      ps['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 40 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(workbook, ps, 'Products');
    }
    if (categories.length) {
      const cs = XLSX.utils.aoa_to_sheet([
        ['category_code', 'name'],
        ...categories.map((c) => [c.code, c.name]),
      ]);
      cs['!cols'] = [{ wch: 18 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(workbook, cs, 'Categories');
    }
    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
  }

  /** Add Product import file prefilled with new products that arrived on a PO. */
  generateProductImport(
    lines: {
      name: string;
      categoryCode: string;
      unit: string;
      sku: string | null;
      warehouseCode: string;
      quantity: number;
      unitPrice: number;
    }[],
    poNumber: string,
  ): Buffer {
    const columns = PRODUCT_DIRECT_IMPORT_COLUMNS;
    const rows: any[][] = [
      ['Stock Management'],
      [],
      ['Request Type', 'PRODUCT_CREATE'],
      [
        `From ${poNumber}: product_code empty = generated automatically. ` +
          'Quantity is what was counted at receiving. Fill product_sku, brand, prices, image_url as needed.',
      ],
      [...columns],
    ];
    for (const line of lines) {
      const values: Record<string, unknown> = {
        product_name: line.name,
        category_code: line.categoryCode,
        has_variants: 'FALSE',
        unit: line.unit,
        product_sku: line.sku ?? '',
        base_price: line.unitPrice,
        warehouse_code: line.warehouseCode,
        quantity: line.quantity,
      };
      rows.push(columns.map((c) => values[c] ?? ''));
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = columns.map((c) => ({ wch: Math.max(c.length + 4, 18) }));
    sheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: '1B365D' } } };
    columns.forEach((_, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: 4, c })];
      cell.s = {
        font: { bold: true, color: { rgb: '002060' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9EAF7' } },
        alignment: { horizontal: 'center' },
      };
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Product Import');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  parse(file: Express.Multer.File): PurchaseOrderImportRow[] {
    if (!file?.buffer) {
      throw new BadRequestException('Excel file is required');
    }
    const ext = file.originalname?.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      throw new BadRequestException(
        'Invalid file type. Only .xlsx, .xls or .csv files are allowed.',
      );
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Workbook contains no sheets');

    const raw: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
    });
    if (raw.length === 0) throw new BadRequestException('The file is empty');

    // The header row is the first one (in the top 10) that has the key columns.
    let headerIndex = -1;
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const names = (raw[i] || []).map((c) => this.column(c));
      if (names.includes('product_code') && names.includes('quantity')) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex < 0) {
      throw new BadRequestException(
        'Missing required columns: product_code, quantity',
      );
    }

    const names = (raw[headerIndex] || []).map((c) => this.column(c));
    const at = (name: string) => names.indexOf(name);
    const iCode = at('product_code');
    const iVariant = at('variant_code');
    const iQty = at('quantity');
    const iPrice = at('unit_price');
    const iName = at('new_product_name');
    const iCategory = at('category_code');
    const iUnit = at('unit');
    const iSku = at('sku');

    const rows: PurchaseOrderImportRow[] = [];
    for (let r = headerIndex + 1; r < raw.length; r++) {
      const cells = raw[r] || [];
      if (cells.every((c) => String(c ?? '').trim() === '')) continue;

      const text = (i: number) => (i < 0 ? '' : String(cells[i] ?? '').trim());
      rows.push({
        row: r + 1,
        productCode: text(iCode),
        variantCode: text(iVariant) || null,
        quantity: this.number(text(iQty)),
        unitPrice: this.number(text(iPrice)),
        newProductName: text(iName) || null,
        categoryCode: text(iCategory).toUpperCase() || null,
        unit: text(iUnit) || null,
        sku: text(iSku) || null,
      });

      if (rows.length > PO_IMPORT_MAX_ROWS) {
        throw new BadRequestException(
          `Too many rows: at most ${PO_IMPORT_MAX_ROWS} products per file`,
        );
      }
    }
    if (rows.length === 0) {
      throw new BadRequestException('The file has no product rows');
    }
    return rows;
  }

  private column(value: unknown): string {
    const c = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (c === 'qty') return 'quantity';
    if (c === 'price' || c === 'cost_price' || c === 'unit_cost') {
      return 'unit_price';
    }
    if (c === 'product_name' || c === 'name') return 'new_product_name';
    if (c === 'category') return 'category_code';
    return c;
  }

  private number(value: string): number | null {
    if (value === '') return null;
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
}
