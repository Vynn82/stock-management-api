import { Controller, Get, Post, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { TelegramService } from './telegram.service';
import { SalesReport } from './interfaces/report.interface';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly telegramService: TelegramService,
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
