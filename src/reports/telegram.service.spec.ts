import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { SalesReportPdfService } from './pdf/sales-report-pdf.service';
import { SalesReport } from './interfaces/report.interface';
import * as dotenv from 'dotenv';
dotenv.config();

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

  // `jest.spyOn(global, 'fetch')` + `restoreAllMocks()` removes Node's lazy
  // global fetch after the first test, so later spies fail with "Property
  // `fetch` does not exist". Assign a plain mock and put the original back.
  const realFetch = (global as any).fetch;
  const stubFetch = (impl: (...args: any[]) => any) => {
    const fn = jest.fn(impl);
    (global as any).fetch = fn;
    return fn;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'TELEGRAM_BOT_TOKEN')
                return (process.env.TELEGRAM_BOT_TOKEN || 'mock-bot-token')
                  .replace(/^["']|["']$/g, '')
                  .trim();
              if (key === 'TELEGRAM_CHAT_ID')
                return (process.env.TELEGRAM_CHAT_ID || 'mock-chat-id')
                  .replace(/^["']|["']$/g, '')
                  .trim();
              return null;
            }),
          },
        },
        {
          provide: SalesReportPdfService,
          useValue: {
            generateReportPdf: jest
              .fn()
              .mockResolvedValue(Buffer.from('%PDF-mock-bytes')),
          },
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
    pdfService = module.get<SalesReportPdfService>(SalesReportPdfService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (global as any).fetch = realFetch;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send both Telegram summary message and PDF document successfully', async () => {
    const mockFetch = stubFetch((url: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('/sendMessage')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ ok: true, result: { message_id: 101 } }),
          } as any);
        }
        if (urlStr.includes('/sendDocument')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ ok: true, result: { message_id: 102 } }),
          } as any);
        }
        return Promise.resolve({ ok: false } as any);
      });

    const result = await service.sendReport(mockReport);

    expect(result.sent).toBe(true);
    expect(result.pdfSent).toBe(true);
    expect(pdfService.generateReportPdf).toHaveBeenCalledWith(mockReport);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should still succeed with summary delivery even if PDF generation throws an error', async () => {
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest
      .spyOn(pdfService, 'generateReportPdf')
      .mockRejectedValueOnce(new Error('PDF generation engine failed'));

    stubFetch(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: { message_id: 101 } }),
      } as any);
    });

    const result = await service.sendReport(mockReport);

    expect(result.sent).toBe(true);
    expect(result.pdfSent).toBe(false);
  });

  it('should still succeed with summary delivery if sendDocument fails', async () => {
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    stubFetch(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes('/sendMessage')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ ok: true, result: { message_id: 101 } }),
        } as any);
      }
      if (urlStr.includes('/sendDocument')) {
        return Promise.resolve({
          ok: false,
          json: () =>
            Promise.resolve({ ok: false, description: 'File too large' }),
        } as any);
      }
      return Promise.resolve({ ok: false } as any);
    });

    const result = await service.sendReport(mockReport);

    expect(result.sent).toBe(true);
    expect(result.pdfSent).toBe(false);
  });
});
