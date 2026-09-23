import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { SalesReportPdfService } from './pdf/sales-report-pdf.service';
import { SalesReport } from './interfaces/report.interface';

describe('TelegramService', () => {
  let service: TelegramService;
  let pdfService: SalesReportPdfService;

  const mockReport: SalesReport = {
    period: 'DAILY',
    title: 'Daily Sales & Stock Report',
    startDate: new Date('2026-09-22T00:00:00.000Z'),
    endDate: new Date('2026-09-22T17:00:00.000Z'),
    totalUnitsSold: 10,
    totalTransactions: 2,
    totalCost: 500,
    totalRevenue: 800,
    netProfit: 300,
    profitMargin: 37.5,
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
    totalInventoryStock: 100,
    lowStockWarnings: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'TELEGRAM_BOT_TOKEN') return 'test_bot_token';
              if (key === 'TELEGRAM_CHAT_ID') return '-123456789';
              return null;
            }),
          },
        },
        {
          provide: SalesReportPdfService,
          useValue: {
            generateReportPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-mock-bytes')),
          },
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
    pdfService = module.get<SalesReportPdfService>(SalesReportPdfService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send both Telegram summary message and PDF document successfully', async () => {
    const mockFetch = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/sendMessage')) {
          return {
            ok: true,
            json: async () => ({ ok: true, result: { message_id: 101 } }),
          } as any;
        }
        if (urlStr.includes('/sendDocument')) {
          return {
            ok: true,
            json: async () => ({ ok: true, result: { message_id: 102 } }),
          } as any;
        }
        return { ok: false } as any;
      });

    const result = await service.sendReport(mockReport);

    expect(result.sent).toBe(true);
    expect(result.pdfSent).toBe(true);
    expect(pdfService.generateReportPdf).toHaveBeenCalledWith(mockReport);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should still succeed with summary delivery even if PDF generation throws an error', async () => {
    jest
      .spyOn(pdfService, 'generateReportPdf')
      .mockRejectedValueOnce(new Error('PDF generation engine failed'));

    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 101 } }),
      } as any;
    });

    const result = await service.sendReport(mockReport);

    expect(result.sent).toBe(true);
    expect(result.pdfSent).toBe(false);
  });

  it('should still succeed with summary delivery if sendDocument fails', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/sendMessage')) {
        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 101 } }),
        } as any;
      }
      if (urlStr.includes('/sendDocument')) {
        return {
          ok: false,
          json: async () => ({ ok: false, description: 'File too large' }),
        } as any;
      }
      return { ok: false } as any;
    });

    const result = await service.sendReport(mockReport);

    expect(result.sent).toBe(true);
    expect(result.pdfSent).toBe(false);
  });
});

