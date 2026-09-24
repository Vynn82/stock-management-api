import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BarcodesService } from './barcodes.service';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { BarcodeFormat, BarcodeSymbology } from './dto/barcode-query.dto';

describe('BarcodesService', () => {
  let service: BarcodesService;

  const mockProductRepository = {
    findOne: jest.fn(),
  };

  const mockVariantRepository = {
    findOne: jest.fn(),
  };

  const mockStockRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BarcodesService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: mockVariantRepository,
        },
        {
          provide: getRepositoryToken(Stock),
          useValue: mockStockRepository,
        },
      ],
    }).compile();

    service = module.get<BarcodesService>(BarcodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateEan13CheckDigit', () => {
    it('should correctly calculate the Modulo-10 checksum digit', () => {
      // 400638133393 -> checksum 1 (4006381333931)
      expect(service.calculateEan13CheckDigit('400638133393')).toBe('1');
      // 885012345678 -> checksum 7 (8850123456787)
      expect(service.calculateEan13CheckDigit('885012345678')).toBe('7');
    });

    it('should throw BadRequestException if digits length is not 12', () => {
      expect(() => service.calculateEan13CheckDigit('123')).toThrow();
    });
  });

  describe('generateBarcodeNumber', () => {
    it('should generate a 13-digit barcode with correct prefix and valid check digit', () => {
      const barcode = service.generateBarcodeNumber('200');
      expect(barcode).toHaveLength(13);
      expect(barcode.startsWith('200')).toBe(true);

      const base12 = barcode.slice(0, 12);
      const expectedCheck = service.calculateEan13CheckDigit(base12);
      expect(barcode.slice(12)).toBe(expectedCheck);
    });
  });

  describe('generateUniqueBarcode', () => {
    it('should return a unique 13-digit barcode not present in repositories', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      mockVariantRepository.findOne.mockResolvedValue(null);

      const uniqueBarcode = await service.generateUniqueBarcode('200');
      expect(uniqueBarcode).toHaveLength(13);
      expect(uniqueBarcode.startsWith('200')).toBe(true);
    });
  });

  describe('generateBarcodePng', () => {
    it('should generate a valid PNG buffer for standard Code128', async () => {
      const buffer = await service.generateBarcodePng('TEST-CODE-12345');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PNG header signature: 0x89 0x50 0x4E 0x47
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });

    it('should throw BadRequestException for empty text', async () => {
      await expect(service.generateBarcodePng('')).rejects.toThrow();
    });
  });

  describe('generateBarcodeSvg', () => {
    it('should generate a valid SVG string', async () => {
      const svg = await service.generateBarcodeSvg('TEST-SVG-999');
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });
  });

  describe('generateQrPng', () => {
    it('should generate a valid QR code PNG buffer', async () => {
      const buffer = await service.generateQrPng('https://example.com/item/123');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
    });
  });

  describe('generateQrSvg', () => {
    it('should generate a valid QR code SVG string', async () => {
      const svg = await service.generateQrSvg('https://example.com/item/123');
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
    });
  });

  describe('lookupByBarcode', () => {
    it('should resolve a product and return structure with stock and barcodes', async () => {
      const mockProduct = {
        id: 'prod-uuid-1',
        code: 'IP16P',
        name: 'iPhone 16 Pro',
        sku: 'IP16P-SKU',
        barcode: '8851234567890',
        costPrice: 850,
        sellingPrice: 1099,
        unit: 'Piece',
        category: { name: 'Smartphones' },
        brand: { name: 'Apple' },
      };

      mockVariantRepository.findOne.mockResolvedValue(null);
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      mockStockRepository.find.mockResolvedValue([
        {
          warehouseId: 'wh-1',
          warehouse: { code: 'WH-MAIN', name: 'Main Warehouse' },
          quantity: 25,
        },
      ]);

      const result = await service.lookupByBarcode('8851234567890');

      expect(result.matchType).toBe('PRODUCT');
      expect(result.product.code).toBe('IP16P');
      expect(result.inventory.totalStock).toBe(25);
      expect(result.barcodes.barcodePng).toContain('data:image/png;base64,');
      expect(result.barcodes.qrPng).toContain('data:image/png;base64,');
    });
  });

  describe('generateProductLabelPdf', () => {
    it('should generate a printable PDF label buffer for thermal printer', async () => {
      const mockProduct = {
        id: 'prod-uuid-1',
        code: 'IP16P',
        name: 'iPhone 16 Pro',
        sku: 'IP16P-SKU',
        barcode: '8851234567890',
        costPrice: 850,
        sellingPrice: 1099,
        unit: 'Piece',
        category: { name: 'Smartphones' },
        brand: { name: 'Apple' },
      };

      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const pdfBuffer = await service.generateProductLabelPdf('prod-uuid-1');
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      // PDF header signature: %PDF
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });
});
