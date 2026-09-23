import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { TelegramService } from './telegram.service';
import { SalesReportPdfService } from './pdf/sales-report-pdf.service';
import { SalesReport } from './interfaces/report.interface';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly telegramService: TelegramService,
    private readonly pdfService: SalesReportPdfService,
  ) {}

  /**
   * Get sales, spending, profit, and stock summary data as JSON.
   */
  @Get('summary')
  async getSummary(
    @Query('period') period?: 'daily' | 'weekly',
  ): Promise<SalesReport> {
    const p = period?.toUpperCase() === 'WEEKLY' ? 'WEEKLY' : 'DAILY';
    return this.reportsService.generateSalesReport(p);
  }

  /**
   * Preview the HTML UI generated for Telegram.
   */
  @Get('preview')
  async getTelegramPreview(
    @Query('period') period?: 'daily' | 'weekly',
  ): Promise<{ period: string; html: string }> {
    const p = period?.toUpperCase() === 'WEEKLY' ? 'WEEKLY' : 'DAILY';
    const report = await this.reportsService.generateSalesReport(p);
    const html = this.telegramService.formatReportHtml(report);
    return {
      period: p,
      html,
    };
  }

  /**
   * Preview and download the generated corporate PDF report directly in browser.
   */
  @Get('pdf')
  async getPdf(
    @Query('period') period: 'daily' | 'weekly',
    @Res() res: Response,
  ) {
    const p = period?.toUpperCase() === 'WEEKLY' ? 'WEEKLY' : 'DAILY';
    const report = await this.reportsService.generateSalesReport(p);
    const pdfBuffer = await this.pdfService.generateReportPdf(report);

    const d = new Date(report.endDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const periodLabel = p === 'WEEKLY' ? 'Weekly' : 'Daily';
    const filename = `${periodLabel} Report ${dateStr}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }

  /**
   * Manually trigger and send the 5:00 PM Daily Report to Telegram.
   */
  @Post('telegram/daily')
  async triggerDailyReport() {
    return this.reportsService.triggerDailyReportManual();
  }

  /**
   * Manually trigger and send the Weekly Report to Telegram.
   */
  @Post('telegram/weekly')
  async triggerWeeklyReport() {
    return this.reportsService.triggerWeeklyReportManual();
  }
}
