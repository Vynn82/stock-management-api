import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  DailyTrendItem,
  DashboardKpis,
  DashboardSummaryResponse,
  LowStockAlertItem,
  OrderSourceBreakdown,
  OrderStatusBreakdown,
  RecentAdjustmentItem,
  RecentOrderItem,
  TopProductItem,
} from './interfaces/dashboard.interface';

@Controller(['dashboard', 'reports/dashboard'])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Unified dashboard endpoint: returns full KPIs, trends, breakdowns, top products, and alerts.
   */
  @Get()
  async getDashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardSummaryResponse> {
    return this.dashboardService.getDashboardSummary(query);
  }

  /**
   * Alias for unified dashboard endpoint.
   */
  @Get('summary')
  async getSummary(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardSummaryResponse> {
    return this.dashboardService.getDashboardSummary(query);
  }

  /**
   * KPI metrics only (Inventory, Orders, Revenue, Customers, Staff, Internal Requests).
   */
  @Get('kpis')
  async getKpis(): Promise<DashboardKpis> {
    return this.dashboardService.getDashboardKpis();
  }

  /**
   * Sales & orders trend over time (default 7 days, up to 90 days).
   */
  @Get('sales-trend')
  async getSalesTrend(
    @Query('days') days?: number,
  ): Promise<{ days: number; trend: DailyTrendItem[] }> {
    return this.dashboardService.getSalesTrend(days ? Number(days) : 7);
  }

  /**
   * Breakdown of orders by status and by source.
   */
  @Get('orders-breakdown')
  async getOrdersBreakdown(): Promise<{
    ordersByStatus: OrderStatusBreakdown[];
    ordersBySource: OrderSourceBreakdown[];
  }> {
    return this.dashboardService.getOrderBreakdowns();
  }

  /**
   * Top-selling products by quantity sold and revenue.
   */
  @Get('top-products')
  async getTopProducts(
    @Query('limit') limit?: number,
  ): Promise<TopProductItem[]> {
    return this.dashboardService.getTopProducts(limit ? Number(limit) : 10);
  }

  /**
   * Urgent low-stock and out-of-stock product alerts.
   */
  @Get('low-stock')
  async getLowStock(
    @Query('limit') limit?: number,
  ): Promise<LowStockAlertItem[]> {
    return this.dashboardService.getLowStockAlerts(limit ? Number(limit) : 10);
  }

  /**
   * Recent customer orders list.
   */
  @Get('recent-orders')
  async getRecentOrders(
    @Query('limit') limit?: number,
  ): Promise<RecentOrderItem[]> {
    return this.dashboardService.getRecentOrders(limit ? Number(limit) : 10);
  }

  /**
   * Recent inventory adjustments list.
   */
  @Get('recent-adjustments')
  async getRecentAdjustments(
    @Query('limit') limit?: number,
  ): Promise<RecentAdjustmentItem[]> {
    return this.dashboardService.getRecentAdjustments(
      limit ? Number(limit) : 10,
    );
  }
}
