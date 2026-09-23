import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SalesReportPdfService } from './sales-report-pdf.service';
import { SalesReport } from '../interfaces/report.interface';
import * as fs from 'fs';
import * as path from 'path';

describe('SalesReportPdfService', () => {
  let service: SalesReportPdfService;
  let configService: ConfigService;

  const mockReport: SalesReport = {
    period: 'DAILY',
    title: 'Daily Sales & Stock Report (Sep 22, 2026)',
    startDate: new Date('2026-09-22T00:00:00.000Z'),
    endDate: new Date('2026-09-22T17:00:00.000Z'),
    totalUnitsSold: 125,
    totalTransactions: 14,
    totalCost: 18200,
    totalRevenue: 25450,
    netProfit: 7250,
    profitMargin: 28.49,
    products: [
      {
        productCode: 'PRD-001',
        productName: 'Mechanical Gaming Keyboard',
        variantCode: 'RGB-BLUE',
        variantName: 'Blue Switch RGB',
        quantitySold: 25,
        costPrice: 45,
        sellingPrice: 75,
        totalCost: 1125,
        totalRevenue: 1875,
        profit: 750,
        profitMargin: 40,
      },
      {
        productCode: 'PRD-002',
        productName: 'Wireless Ergonomic Mouse',
        variantCode: 'BLK',
        variantName: 'Matte Black',
        quantitySold: 40,
        costPrice: 20,
        sellingPrice: 35,
        totalCost: 800,
        totalRevenue: 1400,
        profit: 600,
        profitMargin: 42.86,
      },
      {
        productCode: 'PRD-003',
        productName: 'Ultra-Wide 34-inch Monitor',
        variantCode: '144HZ',
        variantName: '144Hz IPS Panel',
        quantitySold: 10,
        costPrice: 350,
        sellingPrice: 480,
        totalCost: 3500,
        totalRevenue: 4800,
        profit: 1300,
        profitMargin: 27.08,
      },
    ],
    stockIn: {
      totalUnitsReceived: 200,
      totalTransactions: 3,
      totalCost: 8400,
      items: [
        {
          productCode: 'PRD-001',
          productName: 'Mechanical Gaming Keyboard',
          variantCode: 'RGB-BLUE',
          variantName: 'Blue Switch RGB',
          quantityReceived: 50,
          unitCost: 45,
          totalCost: 2250,
        },
        {
          productCode: 'PRD-002',
          productName: 'Wireless Ergonomic Mouse',
          variantCode: 'BLK',
          variantName: 'Matte Black',
          quantityReceived: 150,
          unitCost: 20,
          totalCost: 3000,
        },
      ],
    },
    stockAdjustment: {
      totalAdjustments: 2,
      netQuantity: -4,
      totalDecreaseQuantity: 5,
      totalDecreaseValue: 145,
      totalIncreaseQuantity: 1,
      totalIncreaseValue: 20,
      byReason: [
        {
          reason: 'Damaged in transit',
          adjustmentType: 'DECREASE',
          totalQuantity: 5,
          totalValue: 145,
          items: [
            {
              productCode: 'PRD-001',
              productName: 'Mechanical Gaming Keyboard',
              variantCode: 'RGB-BLUE',
              quantity: 2,
              value: 90,
            },
            {
              productCode: 'PRD-002',
              productName: 'Wireless Ergonomic Mouse',
              variantCode: 'BLK',
              quantity: 3,
              value: 55,
            },
          ],
        },
        {
          reason: 'Supplier bonus surplus',
          adjustmentType: 'INCREASE',
          totalQuantity: 1,
          totalValue: 20,
          items: [
            {
              productCode: 'PRD-002',
              productName: 'Wireless Ergonomic Mouse',
              variantCode: 'BLK',
              quantity: 1,
              value: 20,
            },
          ],
        },
      ],
    },
    totalInventoryStock: 12450,
    lowStockWarnings: [
      {
        productCode: 'PRD-001',
        productName: 'Mechanical Gaming Keyboard',
        variantCode: 'RGB-BLUE',
        currentStock: 4,
        minimumStock: 15,
      },
      {
        productCode: 'PRD-004',
        productName: 'USB-C Fast Charging Cable 2m',
        variantCode: 'BRAIDED',
        currentStock: 0,
        minimumStock: 20,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesReportPdfService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REPORT_LOGO_PATH') {
                return 'assets/logo.png';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SalesReportPdfService>(SalesReportPdfService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a valid PDF buffer with logo when available', async () => {
    const buffer = await service.generateReportPdf(mockReport);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes: %PDF-
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('should generate a valid PDF buffer even when logo path does not exist', async () => {
    jest
      .spyOn(configService, 'get')
      .mockImplementation((key: string) => (key === 'REPORT_LOGO_PATH' ? 'nonexistent/logo.png' : null));

    const buffer = await service.generateReportPdf(mockReport);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('should paginate correctly across multiple pages when there are dozens of products', async () => {
    const largeProductList = Array.from({ length: 45 }, (_, idx) => ({
      productCode: `PRD-${String(idx + 1).padStart(3, '0')}`,
      productName: `Corporate Inventory Product Item #${idx + 1}`,
      variantCode: `VAR-${idx + 1}`,
      variantName: `Standard Variant Option ${idx + 1}`,
      quantitySold: 10 + (idx % 5),
      costPrice: 50,
      sellingPrice: 80,
      totalCost: (10 + (idx % 5)) * 50,
      totalRevenue: (10 + (idx % 5)) * 80,
      profit: (10 + (idx % 5)) * 30,
      profitMargin: 37.5,
    }));

    const multiPageReport: SalesReport = {
      ...mockReport,
      period: 'WEEKLY',
      products: largeProductList,
    };

    const buffer = await service.generateReportPdf(multiPageReport);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(5000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('should cleanly handle an empty report with zero items', async () => {
    const emptyReport: SalesReport = {
      period: 'DAILY',
      title: 'Daily Sales & Stock Report',
      startDate: new Date(),
      endDate: new Date(),
      totalUnitsSold: 0,
      totalTransactions: 0,
      totalCost: 0,
      totalRevenue: 0,
      netProfit: 0,
      profitMargin: 0,
      products: [],
      stockIn: {
        totalUnitsReceived: 0,
        totalTransactions: 0,
        totalCost: 0,
        items: [],
      },
      stockAdjustment: {
        totalAdjustments: 0,
        netQuantity: 0,
        totalDecreaseQuantity: 0,
        totalDecreaseValue: 0,
        totalIncreaseQuantity: 0,
        totalIncreaseValue: 0,
        byReason: [],
      },
      totalInventoryStock: 500,
      lowStockWarnings: [],
    };

    const buffer = await service.generateReportPdf(emptyReport);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});

