import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bwipjs from 'bwip-js';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';

import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import {
  BarcodeFormat,
  BarcodeSymbology,
  GenerateBarcodeQueryDto,
  GenerateQrQueryDto,
  LabelQueryDto,
} from './dto/barcode-query.dto';

@Injectable()
export class BarcodesService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
  ) {}

  /**
   * Calculates the EAN-13 / GTIN-13 modulo-10 check digit for a 12-digit numeric string.
   */
  calculateEan13CheckDigit(digits12: string): string {
    if (!digits12 || digits12.length !== 12 || !/^\d{12}$/.test(digits12)) {
      throw new BadRequestException('Input must be a 12-digit numeric string');
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(digits12[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }

    const remainder = sum % 10;
    const checkDigit = (10 - remainder) % 10;
    return checkDigit.toString();
  }

  /**
   * Generates a valid 13-digit standard EAN-13 barcode number.
   * Format: [3-digit prefix][6-digit timestamp][3-digit random][1-digit Mod-10 Checksum]
   */
  generateBarcodeNumber(prefix = '200'): string {
    const cleanPrefix = prefix.slice(0, 3).padEnd(3, '0');
    const timestampPart = Date.now().toString().slice(-6);
    const randomPart = Math.floor(100 + Math.random() * 900).toString();
    const base12 = `${cleanPrefix}${timestampPart}${randomPart}`.slice(0, 12);
    const checkDigit = this.calculateEan13CheckDigit(base12);
    return `${base12}${checkDigit}`;
  }

  /**
   * Generates a guaranteed unique 13-digit barcode number across products and variants.
   */
  async generateUniqueBarcode(prefix = '200'): Promise<string> {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = this.generateBarcodeNumber(prefix);
      const [existingProduct, existingVariant] = await Promise.all([
        this.productRepository.findOne({ where: { barcode: candidate } }),
        this.variantRepository.findOne({ where: { barcode: candidate } }),
      ]);

      if (!existingProduct && !existingVariant) {
        return candidate;
      }
    }

    // Fallback in rare collision scenario
    const base12 = `${prefix.slice(0, 3)}${Date.now().toString().slice(-9)}`.slice(0, 12);
    return `${base12}${this.calculateEan13CheckDigit(base12)}`;
  }

  /**
   * Generates a 1D Barcode as a PNG Buffer using bwip-js.
   */
  async generateBarcodePng(
    text: string,
    options?: Partial<GenerateBarcodeQueryDto>,
  ): Promise<Buffer> {
    if (!text || !text.trim()) {
      throw new BadRequestException('Barcode text cannot be empty');
    }

    const bcid = options?.bcid || BarcodeSymbology.CODE128;
    const scale = options?.scale ?? 3;
    const height = options?.height ?? 10;
    const includetext = options?.includetext !== false;

    return bwipjs.toBuffer({
      bcid,
      text: text.trim(),
      scale,
      height,
      includetext,
      textxalign: 'center',
      backgroundcolor: 'ffffff',
      paddingwidth: 5,
      paddingheight: 5,
    });
  }

  /**
   * Generates a 1D Barcode as an SVG string using bwip-js.
   */
  async generateBarcodeSvg(
    text: string,
    options?: Partial<GenerateBarcodeQueryDto>,
  ): Promise<string> {
    if (!text || !text.trim()) {
      throw new BadRequestException('Barcode text cannot be empty');
    }

    const bcid = options?.bcid || BarcodeSymbology.CODE128;
    const scale = options?.scale ?? 3;
    const height = options?.height ?? 10;
    const includetext = options?.includetext !== false;

    return bwipjs.toSVG({
      bcid,
      text: text.trim(),
      scale,
      height,
      includetext,
      textxalign: 'center',
    });
  }

  /**
   * Generates a 2D QR Code as a PNG Buffer using qrcode.
   */
  async generateQrPng(
    text: string,
    options?: Partial<GenerateQrQueryDto>,
  ): Promise<Buffer> {
    if (!text || !text.trim()) {
      throw new BadRequestException('QR code data cannot be empty');
    }

    return QRCode.toBuffer(text.trim(), {
      width: options?.width ?? 300,
      margin: options?.margin ?? 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }

  /**
   * Generates a 2D QR Code as an SVG string.
   */
  async generateQrSvg(
    text: string,
    options?: Partial<GenerateQrQueryDto>,
  ): Promise<string> {
    if (!text || !text.trim()) {
      throw new BadRequestException('QR code data cannot be empty');
    }

    return QRCode.toString(text.trim(), {
      type: 'svg',
      width: options?.width ?? 300,
      margin: options?.margin ?? 2,
      errorCorrectionLevel: 'M',
    });
  }

  /**
   * Generates a 2D QR Code as a Base64 Data URL.
   */
  async generateQrDataUrl(
    text: string,
    options?: Partial<GenerateQrQueryDto>,
  ): Promise<string> {
    if (!text || !text.trim()) {
      throw new BadRequestException('QR code data cannot be empty');
    }

    return QRCode.toDataURL(text.trim(), {
      width: options?.width ?? 300,
      margin: options?.margin ?? 2,
      errorCorrectionLevel: 'M',
    });
  }

  /**
   * Resolves a product by UUID, code, SKU, or barcode.
   */
  async findProductByIdOrCode(idOrCode: string): Promise<Product> {
    if (!idOrCode || !idOrCode.trim()) {
      throw new BadRequestException('Product identifier cannot be empty');
    }

    const clean = idOrCode.trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        clean,
      );

    const whereConditions: any[] = [
      { code: clean },
      { sku: clean },
      { barcode: clean },
    ];
    if (isUuid) {
      whereConditions.unshift({ id: clean });
    }

    const product = await this.productRepository.findOne({
      where: whereConditions,
      relations: {
        category: true,
        brand: true,
        supplier: true,
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with ID, Code, SKU, or Barcode "${clean}" not found`,
      );
    }

    return product;
  }

  /**
   * Resolves a product variant by UUID, code, SKU, or barcode.
   */
  async findVariantByIdOrCode(idOrCode: string): Promise<ProductVariant> {
    if (!idOrCode || !idOrCode.trim()) {
      throw new BadRequestException('Variant identifier cannot be empty');
    }

    const clean = idOrCode.trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        clean,
      );

    const whereConditions: any[] = [
      { code: clean },
      { sku: clean },
      { barcode: clean },
    ];
    if (isUuid) {
      whereConditions.unshift({ id: clean });
    }

    const variant = await this.variantRepository.findOne({
      where: whereConditions,
      relations: {
        product: {
          category: true,
          brand: true,
          supplier: true,
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(
        `Product variant with ID, Code, SKU, or Barcode "${clean}" not found`,
      );
    }

    return variant;
  }

  /**
   * Fast Scanner / Lookup Endpoint: Resolves a scanned barcode, SKU, product code, or UUID.
   * Returns matching product/variant entity, category/brand metadata, and live warehouse inventory.
   */
  async lookupByBarcode(rawCode: string) {
    if (!rawCode || !rawCode.trim()) {
      throw new BadRequestException('Scan code cannot be empty');
    }

    const code = rawCode.trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        code,
      );

    // 1. Check Product Variant first (for specific SKU/barcode/code/ID match)
    const variantWhere: any[] = [
      { barcode: code },
      { sku: code },
      { code: code },
    ];
    if (isUuid) {
      variantWhere.unshift({ id: code });
    }

    const variant = await this.variantRepository.findOne({
      where: variantWhere,
      relations: {
        product: {
          category: true,
          brand: true,
          supplier: true,
        },
      },
    });

    if (variant) {
      const variantStocks = await this.stockRepository.find({
        where: { variantId: variant.id },
        relations: { warehouse: true },
      });

      const totalStock = variantStocks.reduce(
        (sum, s) => sum + Number(s.quantity),
        0,
      );

      const barcodeValue = variant.barcode || variant.sku || variant.code;
      const [barcodePngBase64, qrPngBase64] = await Promise.all([
        this.generateBarcodePng(barcodeValue).then((b) => b.toString('base64')),
        this.generateQrPng(
          JSON.stringify({
            type: 'VARIANT',
            productId: variant.product.id,
            productCode: variant.product.code,
            variantId: variant.id,
            variantCode: variant.code,
            sku: variant.sku,
            barcode: variant.barcode,
            sellingPrice: variant.sellingPrice ?? variant.product.sellingPrice,
          }),
        ).then((b) => b.toString('base64')),
      ]);

      return {
        matchType: 'VARIANT',
        product: {
          id: variant.product.id,
          code: variant.product.code,
          name: variant.product.name,
          category: variant.product.category?.name,
          brand: variant.product.brand?.name,
          unit: variant.product.unit,
          image: variant.product.image,
        },
        variant: {
          id: variant.id,
          code: variant.code,
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode,
          attributes: variant.attributes,
          costPrice: Number(variant.costPrice ?? variant.product.costPrice),
          sellingPrice: Number(
            variant.sellingPrice ?? variant.product.sellingPrice,
          ),
          image: variant.image,
          isActive: variant.isActive,
        },
        inventory: {
          totalStock,
          warehouses: variantStocks.map((s) => ({
            warehouseId: s.warehouseId,
            warehouseCode: s.warehouse.code,
            warehouseName: s.warehouse.name,
            quantity: Number(s.quantity),
          })),
        },
        barcodes: {
          barcodeValue,
          barcodePng: `data:image/png;base64,${barcodePngBase64}`,
          qrPng: `data:image/png;base64,${qrPngBase64}`,
        },
      };
    }

    // 2. Check Product
    const productWhere: any[] = [
      { barcode: code },
      { sku: code },
      { code: code },
    ];
    if (isUuid) {
      productWhere.unshift({ id: code });
    }

    const product = await this.productRepository.findOne({
      where: productWhere,
      relations: {
        category: true,
        brand: true,
        supplier: true,
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `No product or variant found matching ID, Code, SKU or Barcode "${code}"`,
      );
    }

    const productStocks = await this.stockRepository.find({
      where: { productId: product.id },
      relations: { warehouse: true },
    });

    const totalStock = productStocks.reduce(
      (sum, s) => sum + Number(s.quantity),
      0,
    );

    const barcodeValue = product.barcode || product.sku || product.code;
    const [barcodePngBase64, qrPngBase64] = await Promise.all([
      this.generateBarcodePng(barcodeValue).then((b) => b.toString('base64')),
      this.generateQrPng(
        JSON.stringify({
          type: 'PRODUCT',
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          sellingPrice: product.sellingPrice,
        }),
      ).then((b) => b.toString('base64')),
    ]);

    return {
      matchType: 'PRODUCT',
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category?.name,
        brand: product.brand?.name,
        supplier: product.supplier?.name,
        unit: product.unit,
        sku: product.sku,
        barcode: product.barcode,
        costPrice: Number(product.costPrice),
        sellingPrice: Number(product.sellingPrice),
        minimumStock: Number(product.minimumStock),
        maximumStock: product.maximumStock ? Number(product.maximumStock) : null,
        hasVariants: product.hasVariants,
        image: product.image,
        isActive: product.isActive,
      },
      variantsCount: product.variants?.length || 0,
      inventory: {
        totalStock,
        warehouses: productStocks.map((s) => ({
          warehouseId: s.warehouseId,
          warehouseCode: s.warehouse.code,
          warehouseName: s.warehouse.name,
          variantId: s.variantId,
          quantity: Number(s.quantity),
        })),
      },
      barcodes: {
        barcodeValue,
        barcodePng: `data:image/png;base64,${barcodePngBase64}`,
        qrPng: `data:image/png;base64,${qrPngBase64}`,
      },
    };
  }

  /**
   * Generates a printable PDF label for a Product.
   * Thermal Label size: 2.25 x 1.25 inches (162 x 90 points) or standard sticker.
   */
  async generateProductLabelPdf(
    productId: string,
    options?: LabelQueryDto,
  ): Promise<Buffer> {
    const product = await this.findProductByIdOrCode(productId);

    const barcodeText = product.barcode || product.sku || product.code;
    const barcodePng = await this.generateBarcodePng(barcodeText, {
      scale: 3,
      height: 12,
      includetext: true,
    });

    const qrData = JSON.stringify({
      code: product.code,
      sku: product.sku,
      barcode: product.barcode,
      price: product.sellingPrice,
    });
    const qrPng = await this.generateQrPng(qrData, { width: 120, margin: 1 });

    const copies = options?.copies ?? 1;

    return new Promise((resolve, reject) => {
      // 55mm x 35mm in PDF points (1mm ≈ 2.83465 pt) -> ~156 x 99 pt
      const doc = new PDFDocument({
        size: [160, 100],
        margins: { top: 4, bottom: 4, left: 6, right: 6 },
        autoFirstPage: false,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      for (let i = 0; i < copies; i++) {
        doc.addPage();

        // Header: Brand / Category
        doc
          .fontSize(6)
          .font('Helvetica-Bold')
          .fillColor('#002060')
          .text(
            `${product.brand?.name ?? 'STOCK'} • ${product.category?.name ?? 'ITEM'}`.toUpperCase(),
            6,
            5,
            { width: 148, ellipsis: true },
          );

        // Product Name
        doc
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .fillColor('#111827')
          .text(product.name, 6, 13, { width: 148, height: 16, ellipsis: true });

        // Left: 1D Barcode
        doc.image(barcodePng, 6, 30, { width: 95, height: 38 });

        // Right: 2D QR Code
        doc.image(qrPng, 106, 28, { width: 44, height: 44 });

        // Bottom Banner: SKU & Selling Price
        doc.rect(4, 76, 152, 19).fillAndStroke('#F3F4F6', '#E5E7EB');

        doc
          .fontSize(6.5)
          .font('Helvetica')
          .fillColor('#4B5563')
          .text(`SKU: ${product.sku}`, 8, 80, { width: 85, ellipsis: true });

        doc
          .fontSize(6)
          .font('Helvetica')
          .fillColor('#6B7280')
          .text(`Unit: ${product.unit}`, 8, 87, { width: 85, ellipsis: true });

        if (options?.includePrice !== false) {
          doc
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .fillColor('#059669')
            .text(`$${Number(product.sellingPrice).toFixed(2)}`, 90, 81, {
              width: 62,
              align: 'right',
            });
        }
      }

      doc.end();
    });
  }

  /**
   * Generates a printable PDF label for a Product Variant.
   */
  async generateVariantLabelPdf(
    variantId: string,
    options?: LabelQueryDto,
  ): Promise<Buffer> {
    const variant = await this.findVariantByIdOrCode(variantId);
    const product = variant.product;
    const barcodeText = variant.barcode || variant.sku || variant.code;
    const barcodePng = await this.generateBarcodePng(barcodeText, {
      scale: 3,
      height: 12,
      includetext: true,
    });

    const qrData = JSON.stringify({
      code: variant.code,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.sellingPrice ?? product.sellingPrice,
    });
    const qrPng = await this.generateQrPng(qrData, { width: 120, margin: 1 });

    const copies = options?.copies ?? 1;
    const sellingPrice = Number(variant.sellingPrice ?? product.sellingPrice);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [160, 100],
        margins: { top: 4, bottom: 4, left: 6, right: 6 },
        autoFirstPage: false,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      for (let i = 0; i < copies; i++) {
        doc.addPage();

        // Header: Brand / Category
        doc
          .fontSize(6)
          .font('Helvetica-Bold')
          .fillColor('#002060')
          .text(
            `${product.brand?.name ?? 'STOCK'} • ${product.category?.name ?? 'ITEM'}`.toUpperCase(),
            6,
            5,
            { width: 148, ellipsis: true },
          );

        // Variant Name & Product Name
        doc
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .fillColor('#111827')
          .text(variant.name, 6, 13, { width: 148, height: 16, ellipsis: true });

        // Left: 1D Barcode
        doc.image(barcodePng, 6, 30, { width: 95, height: 38 });

        // Right: 2D QR Code
        doc.image(qrPng, 106, 28, { width: 44, height: 44 });

        // Bottom Banner
        doc.rect(4, 76, 152, 19).fillAndStroke('#F3F4F6', '#E5E7EB');

        doc
          .fontSize(6.5)
          .font('Helvetica')
          .fillColor('#4B5563')
          .text(`SKU: ${variant.sku}`, 8, 80, { width: 85, ellipsis: true });

        const attrSummary = variant.attributes
          ? Object.entries(variant.attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : product.unit;

        doc
          .fontSize(5.5)
          .font('Helvetica')
          .fillColor('#6B7280')
          .text(attrSummary, 8, 87, { width: 85, ellipsis: true });

        if (options?.includePrice !== false) {
          doc
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .fillColor('#059669')
            .text(`$${sellingPrice.toFixed(2)}`, 90, 81, {
              width: 62,
              align: 'right',
            });
        }
      }

      doc.end();
    });
  }

  /**
   * Streams 1D Barcode (PNG or SVG) to an Express Response.
   */
  async stream1dBarcode(
    text: string,
    query: Partial<GenerateBarcodeQueryDto>,
    res: any,
  ): Promise<void> {
    if (query?.format === BarcodeFormat.SVG) {
      const svg = await this.generateBarcodeSvg(text, query);
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const png = await this.generateBarcodePng(text, query);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', png.length.toString());
    return res.end(png);
  }

  /**
   * Streams 2D QR Code (PNG or SVG) to an Express Response.
   */
  async streamQrCode(
    text: string,
    query: Partial<GenerateQrQueryDto>,
    res: any,
  ): Promise<void> {
    if (query?.format === BarcodeFormat.SVG) {
      const svg = await this.generateQrSvg(text, query);
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const png = await this.generateQrPng(text, query);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', png.length.toString());
    return res.end(png);
  }

  /**
   * Streams Product 1D Barcode to an Express Response.
   */
  async streamProductBarcode(
    id: string,
    query: Partial<GenerateBarcodeQueryDto>,
    res: any,
  ): Promise<void> {
    const product = await this.findProductByIdOrCode(id);
    const barcodeText = product.barcode || product.sku || product.code;
    return this.stream1dBarcode(barcodeText, query, res);
  }

  /**
   * Streams Product 2D QR Code to an Express Response.
   */
  async streamProductQr(
    id: string,
    query: Partial<GenerateQrQueryDto>,
    res: any,
  ): Promise<void> {
    const product = await this.findProductByIdOrCode(id);
    const qrData = JSON.stringify({
      id: product.id,
      code: product.code,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: product.sellingPrice,
    });
    return this.streamQrCode(qrData, query, res);
  }

  /**
   * Streams Product Printable PDF Label to an Express Response.
   */
  async streamProductLabel(
    id: string,
    query: LabelQueryDto,
    res: any,
  ): Promise<void> {
    const pdfBuffer = await this.generateProductLabelPdf(id, query);
    const filename = `product-label-${id}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    return res.end(pdfBuffer);
  }

  /**
   * Streams Variant 1D Barcode to an Express Response.
   */
  async streamVariantBarcode(
    id: string,
    query: Partial<GenerateBarcodeQueryDto>,
    res: any,
  ): Promise<void> {
    const variant = await this.findVariantByIdOrCode(id);
    const barcodeText = variant.barcode || variant.sku || variant.code;
    return this.stream1dBarcode(barcodeText, query, res);
  }

  /**
   * Streams Variant 2D QR Code to an Express Response.
   */
  async streamVariantQr(
    id: string,
    query: Partial<GenerateQrQueryDto>,
    res: any,
  ): Promise<void> {
    const variant = await this.findVariantByIdOrCode(id);
    const qrData = JSON.stringify({
      productId: variant.product?.id || variant.productId,
      variantId: variant.id,
      code: variant.code,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.sellingPrice ?? variant.product?.sellingPrice,
    });
    return this.streamQrCode(qrData, query, res);
  }

  /**
   * Streams Variant Printable PDF Label to an Express Response.
   */
  async streamVariantLabel(
    id: string,
    query: LabelQueryDto,
    res: any,
  ): Promise<void> {
    const pdfBuffer = await this.generateVariantLabelPdf(id, query);
    const filename = `variant-label-${id}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    return res.end(pdfBuffer);
  }
}
