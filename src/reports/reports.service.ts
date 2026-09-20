import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';

import { Request } from '../requests/entities/request.entity';
import { RequestType } from '../requests/enum/request-type.enum';
import { RequestStatus } from '../requests/enum/request-status.enum';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import { TelegramService } from './telegram.service';
import {
  AdjustmentReasonGroup,
  LowStockWarning,
  ProductSalesSummary,
  SalesReport,
  StockAdjustmentReport,
  StockInReport,
  StockInSummaryItem,
} from './interfaces/report.interface';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepository: Repository<Request>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockAdjustment)
    private readonly stockAdjustmentRepository: Repository<StockAdjustment>,

    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Cron Job: Runs daily at 5:00 PM (17:00:00).
   */
  @Cron('0 17 * * *')
  async handleDailyReport(): Promise<void> {
    this.logger.log(
      'Executing scheduled 5:00 PM Daily Sales & Stock Report...',
    );
    try {
      const report = await this.generateSalesReport('DAILY');
      await this.telegramService.sendReport(report);
    } catch (error: any) {
      this.logger.error(
        `Error in daily report cron: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Cron Job: Runs weekly every Sunday at 5:00 PM (17:00:00).
   */
  @Cron('0 17 * * 0')
  async handleWeeklyReport(): Promise<void> {
    this.logger.log(
      'Executing scheduled Sunday 5:00 PM Weekly Sales & Stock Report...',
    );
    try {
      const report = await this.generateSalesReport('WEEKLY');
      await this.telegramService.sendReport(report);
    } catch (error: any) {
      this.logger.error(
        `Error in weekly report cron: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Generates sales, stock-in, stock adjustments, profit, and inventory report.
   */
  async generateSalesReport(period: 'DAILY' | 'WEEKLY'): Promise<SalesReport> {
    const now = new Date();
    let startDate: Date;
    const endDate = now;

    if (period === 'DAILY') {
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
    } else {
      // Past 7 days
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // =========================================================================
    // 1. FETCH PRODUCTS & VARIANTS (for price resolution & catalog lookup)
    // =========================================================================
    const products = await this.productRepository.find({
      relations: {
        variants: true,
      },
    });

    const productMap = new Map<string, Product>();
    for (const p of products) {
      productMap.set(p.code, p);
    }

    // =========================================================================
    // 2. STOCK OUT (SALES)
    // =========================================================================
    const stockOutRequests = await this.requestRepository.find({
      where: {
        requestType: RequestType.STOCK_OUT,
        status: RequestStatus.APPROVED,
        updatedAt: Between(startDate, endDate),
      },
      relations: {
        items: true,
      },
    });

    const salesMap = new Map<string, ProductSalesSummary>();
    let totalUnitsSold = 0;
    let totalCost = 0;
    let totalRevenue = 0;

    for (const req of stockOutRequests) {
      for (const item of req.items ?? []) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        const product = productMap.get(item.productCode);
        const variant = product?.variants?.find(
          (v) => v.code === item.variantCode,
        );

        const costPrice = Number(
          item.variantCostPrice ??
            variant?.costPrice ??
            item.productCostPrice ??
            product?.costPrice ??
            0,
        );

        const sellingPrice = Number(
          item.variantSellingPrice ??
            variant?.sellingPrice ??
            item.productSellingPrice ??
            product?.sellingPrice ??
            0,
        );

        const itemCost = costPrice * qty;
        const itemRevenue = sellingPrice * qty;
        const itemProfit = itemRevenue - itemCost;

        totalUnitsSold += qty;
        totalCost += itemCost;
        totalRevenue += itemRevenue;

        const groupKey = `${item.productCode}_${item.variantCode || 'MAIN'}`;
        const existing = salesMap.get(groupKey);

        if (existing) {
          existing.quantitySold += qty;
          existing.totalCost += itemCost;
          existing.totalRevenue += itemRevenue;
          existing.profit += itemProfit;
          existing.profitMargin =
            existing.totalRevenue > 0
              ? (existing.profit / existing.totalRevenue) * 100
              : 0;
        } else {
          const profitMargin =
            itemRevenue > 0 ? (itemProfit / itemRevenue) * 100 : 0;

          salesMap.set(groupKey, {
            productCode: item.productCode,
            productName: item.productName || product?.name || item.productCode,
            variantCode: item.variantCode || null,
            variantName: item.variantName || variant?.name || null,
            quantitySold: qty,
            costPrice,
            sellingPrice,
            totalCost: itemCost,
            totalRevenue: itemRevenue,
            profit: itemProfit,
            profitMargin,
          });
        }
      }
    }

    const aggregatedProducts = Array.from(salesMap.values()).sort(
      (a, b) => b.quantitySold - a.quantitySold,
    );

    const netProfit = totalRevenue - totalCost;
    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // =========================================================================
    // 3. STOCK IN (INCOMING / RESTOCKED GOODS)
    // =========================================================================
    const stockInRequests = await this.requestRepository.find({
      where: {
        requestType: RequestType.STOCK_IN,
        status: RequestStatus.APPROVED,
        updatedAt: Between(startDate, endDate),
      },
      relations: {
        items: true,
      },
    });

    const stockInMap = new Map<string, StockInSummaryItem>();
    let totalStockInUnits = 0;
    let totalStockInCost = 0;

    for (const req of stockInRequests) {
      for (const item of req.items ?? []) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        const product = productMap.get(item.productCode);
        const variant = product?.variants?.find(
          (v) => v.code === item.variantCode,
        );
        const unitCost = Number(
          item.variantCostPrice ??
            variant?.costPrice ??
            item.productCostPrice ??
            product?.costPrice ??
            0,
        );
        const itemCost = unitCost * qty;

        totalStockInUnits += qty;
        totalStockInCost += itemCost;

        const groupKey = `${item.productCode}_${item.variantCode || 'MAIN'}`;
        const existing = stockInMap.get(groupKey);

        if (existing) {
          existing.quantityReceived += qty;
          existing.totalCost += itemCost;
        } else {
          stockInMap.set(groupKey, {
            productCode: item.productCode,
            productName: item.productName || product?.name || item.productCode,
            variantCode: item.variantCode || null,
            variantName: item.variantName || variant?.name || null,
            quantityReceived: qty,
            unitCost,
            totalCost: itemCost,
          });
        }
      }
    }

    const stockInReport: StockInReport = {
      totalUnitsReceived: totalStockInUnits,
      totalTransactions: stockInRequests.length,
      totalCost: totalStockInCost,
      items: Array.from(stockInMap.values()).sort(
        (a, b) => b.quantityReceived - a.quantityReceived,
      ),
    };

    // =========================================================================
    // 4. STOCK ADJUSTMENTS (DAMAGED, BROKEN, AUDIT DIFFERENCES, ETC.)
    // =========================================================================
    const stockAdjustments = await this.stockAdjustmentRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: {
        product: true,
        variant: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    let totalAdjustments = stockAdjustments.length;
    let netQuantity = 0;
    let totalDecreaseQuantity = 0;
    let totalDecreaseValue = 0;
    let totalIncreaseQuantity = 0;
    let totalIncreaseValue = 0;

    const reasonMap = new Map<string, AdjustmentReasonGroup>();

    for (const adj of stockAdjustments) {
      const qty = Number(adj.quantity || 0);
      const isDecrease = adj.adjustmentType === 'DECREASE';
      const costPrice = Number(
        adj.variant?.costPrice ?? adj.product?.costPrice ?? 0,
      );
      const value = costPrice * qty;

      if (isDecrease) {
        netQuantity -= qty;
        totalDecreaseQuantity += qty;
        totalDecreaseValue += value;
      } else {
        netQuantity += qty;
        totalIncreaseQuantity += qty;
        totalIncreaseValue += value;
      }

      const rawReason = adj.reason?.trim() || 'General Adjustment';
      const groupKey = `${rawReason}_${adj.adjustmentType}`;
      const existing = reasonMap.get(groupKey);

      const itemDetail = {
        productCode: adj.product?.code || 'UNKNOWN',
        productName: adj.product?.name || 'Unknown Product',
        variantCode: adj.variant?.code || null,
        quantity: qty,
        value,
      };

      if (existing) {
        existing.totalQuantity += qty;
        existing.totalValue += value;
        existing.items.push(itemDetail);
      } else {
        reasonMap.set(groupKey, {
          reason: rawReason,
          adjustmentType: adj.adjustmentType,
          totalQuantity: qty,
          totalValue: value,
          items: [itemDetail],
        });
      }
    }

    const stockAdjustmentReport: StockAdjustmentReport = {
      totalAdjustments,
      netQuantity,
      totalDecreaseQuantity,
      totalDecreaseValue,
      totalIncreaseQuantity,
      totalIncreaseValue,
      byReason: Array.from(reasonMap.values()).sort(
        (a, b) => b.totalQuantity - a.totalQuantity,
      ),
    };

    // =========================================================================
    // 5. INVENTORY OVERVIEW & LOW STOCK WARNINGS
    // =========================================================================
    const allStocks = await this.stockRepository.find({
      relations: {
        product: true,
        variant: true,
      },
    });

    let totalInventoryStock = 0;
    const productStockSumMap = new Map<string, number>();

    for (const stock of allStocks) {
      const q = Number(stock.quantity || 0);
      totalInventoryStock += q;

      const code = stock.product?.code;
      if (code) {
        productStockSumMap.set(code, (productStockSumMap.get(code) || 0) + q);
      }
    }

    const lowStockWarnings: LowStockWarning[] = [];
    for (const p of products) {
      if (!p.isActive) continue;
      const currentStock = productStockSumMap.get(p.code) || 0;
      const minStock = Number(p.minimumStock || 0);

      if (minStock > 0 && currentStock <= minStock) {
        lowStockWarnings.push({
          productCode: p.code,
          productName: p.name,
          currentStock,
          minimumStock: minStock,
        });
      }
    }

    return {
      period,
      title:
        period === 'DAILY'
          ? 'Daily Stock & Sales Report'
          : 'Weekly Stock & Sales Report',
      startDate,
      endDate,
      totalUnitsSold,
      totalTransactions: stockOutRequests.length,
      totalCost,
      totalRevenue,
      netProfit,
      profitMargin,
      products: aggregatedProducts,
      stockIn: stockInReport,
      stockAdjustment: stockAdjustmentReport,
      totalInventoryStock,
      lowStockWarnings,
    };
  }

  /**
   * Manually triggers the Daily Report to Telegram.
   */
  async triggerDailyReportManual(): Promise<{
    sent: boolean;
    message: string;
    report: SalesReport;
  }> {
    const report = await this.generateSalesReport('DAILY');
    const result = await this.telegramService.sendReport(report);
    return {
      ...result,
      report,
    };
  }

  /**
   * Manually triggers the Weekly Report to Telegram.
   */
  async triggerWeeklyReportManual(): Promise<{
    sent: boolean;
    message: string;
    report: SalesReport;
  }> {
    const report = await this.generateSalesReport('WEEKLY');
    const result = await this.telegramService.sendReport(report);
    return {
      ...result,
      report,
    };
  }
}
