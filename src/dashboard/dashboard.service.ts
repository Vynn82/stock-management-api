import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import { CustomerOrder } from '../customer-orders/entities/customer-order.entity';
import { CustomerOrderItem } from '../customer-orders/entities/customer-order-item.entity';
import { Customer } from '../customer-orders/entities/customer.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Request } from '../requests/entities/request.entity';
import { RequestStatus } from '../requests/enum/request-status.enum';
import { RequestType } from '../requests/enum/request-type.enum';
import { CustomerOrderStatus } from '../customer-orders/enums/customer-order-status.enum';
import { CustomerStatus } from '../customer-orders/enums/customer-status.enum';
import { PaymentStatus } from '../customer-orders/enums/customer-order-enums';

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

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockAdjustment)
    private readonly stockAdjustmentRepository: Repository<StockAdjustment>,

    @InjectRepository(CustomerOrder)
    private readonly orderRepository: Repository<CustomerOrder>,

    @InjectRepository(CustomerOrderItem)
    private readonly orderItemRepository: Repository<CustomerOrderItem>,

    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,

    @InjectRepository(Request)
    private readonly requestRepository: Repository<Request>,
  ) {}

  /**
   * Returns unified full dashboard summary including KPIs, trends, top products, alerts and recent activity.
   */
  async getDashboardSummary(
    query?: DashboardQueryDto,
  ): Promise<DashboardSummaryResponse> {
    const days = query?.days && query.days > 0 ? query.days : 7;
    const limit = query?.limit && query.limit > 0 ? query.limit : 10;

    const [
      kpis,
      salesTrend,
      { ordersByStatus, ordersBySource },
      topProducts,
      lowStockAlerts,
      recentOrders,
      recentAdjustments,
    ] = await Promise.all([
      this.getDashboardKpis(),
      this.getSalesTrend(days),
      this.getOrderBreakdowns(),
      this.getTopProducts(limit),
      this.getLowStockAlerts(limit),
      this.getRecentOrders(limit),
      this.getRecentAdjustments(limit),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      kpis,
      salesTrend: salesTrend.trend,
      ordersByStatus,
      ordersBySource,
      topProducts,
      lowStockAlerts,
      recentOrders,
      recentAdjustments,
    };
  }

  /**
   * Computes all KPI metrics across Inventory, Customer Orders, Financials, Customers, Staff, and Internal Requests.
   */
  async getDashboardKpis(): Promise<DashboardKpis> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );

    // =========================================================================
    // 1. INVENTORY KPIS
    // =========================================================================
    const [totalProducts, totalVariants, totalWarehouses] = await Promise.all([
      this.productRepository.count({ where: { isActive: true } }),
      this.variantRepository.count({ where: { isActive: true } }),
      this.warehouseRepository.count({ where: { isActive: true } }),
    ]);

    const stockSumRaw = await this.stockRepository
      .createQueryBuilder('s')
      .leftJoin('s.product', 'p')
      .leftJoin('s.variant', 'v')
      .select('COALESCE(SUM(s.quantity), 0)', 'totalQuantity')
      .addSelect(
        'COALESCE(SUM(s.quantity * COALESCE(v.cost_price, p.cost_price, 0)), 0)',
        'totalValue',
      )
      .getRawOne();

    const totalStockQuantity = Number(stockSumRaw?.totalQuantity || 0);
    const totalStockValue = Number(stockSumRaw?.totalValue || 0);

    // Low stock and out of stock counts
    const activeProducts = await this.productRepository.find({
      where: { isActive: true },
      select: { id: true, minimumStock: true },
    });

    const stockByProductRaw = await this.stockRepository
      .createQueryBuilder('s')
      .select('s.product_id', 'productId')
      .addSelect('COALESCE(SUM(s.quantity), 0)', 'totalStock')
      .groupBy('s.product_id')
      .getRawMany();

    const productStockMap = new Map<string, number>();
    for (const row of stockByProductRaw) {
      productStockMap.set(row.productId, Number(row.totalStock || 0));
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of activeProducts) {
      const currentStock = productStockMap.get(p.id) || 0;
      const minStock = Number(p.minimumStock || 0);

      if (currentStock <= 0) {
        outOfStockCount++;
      } else if (minStock > 0 && currentStock <= minStock) {
        lowStockCount++;
      }
    }

    // =========================================================================
    // 2. ORDER STATUS COUNTS
    // =========================================================================
    const statusCountsRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(o.id)', 'count')
      .groupBy('o.status')
      .getRawMany();

    const statusMap = new Map<string, number>();
    let totalOrders = 0;

    for (const row of statusCountsRaw) {
      const c = Number(row.count || 0);
      statusMap.set(row.status, c);
      totalOrders += c;
    }

    const [todayOrders, thisWeekOrders, thisMonthOrders] = await Promise.all([
      this.orderRepository.count({
        where: { createdAt: MoreThanOrEqual(todayStart) },
      }),
      this.orderRepository.count({
        where: { createdAt: MoreThanOrEqual(weekStart) },
      }),
      this.orderRepository.count({
        where: { createdAt: MoreThanOrEqual(monthStart) },
      }),
    ]);

    // =========================================================================
    // 3. REVENUE KPIS (Confirmed, Delivered, or Paid Orders)
    // =========================================================================
    const validSalesStatuses = [
      CustomerOrderStatus.CONFIRMED,
      CustomerOrderStatus.DELIVERED,
    ];

    const totalRevRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.status IN (:...statuses)', { statuses: validSalesStatuses })
      .getRawOne();

    const todayRevRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.status IN (:...statuses)', { statuses: validSalesStatuses })
      .andWhere('o.created_at >= :today', { today: todayStart })
      .getRawOne();

    const weekRevRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.status IN (:...statuses)', { statuses: validSalesStatuses })
      .andWhere('o.created_at >= :week', { week: weekStart })
      .getRawOne();

    const monthRevRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.status IN (:...statuses)', { statuses: validSalesStatuses })
      .andWhere('o.created_at >= :month', { month: monthStart })
      .getRawOne();

    const paidRevRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.payment_status = :paid', { paid: PaymentStatus.PAID })
      .getRawOne();

    const unpaidRevRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.payment_status != :paid', { paid: PaymentStatus.PAID })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [CustomerOrderStatus.CANCELLED, CustomerOrderStatus.REJECTED],
      })
      .getRawOne();

    // =========================================================================
    // 4. CUSTOMERS & STAFF
    // =========================================================================
    const [
      totalCustomers,
      activeCustomers,
      newCustomersToday,
      newCustomersThisWeek,
      totalStaff,
      activeStaff,
    ] = await Promise.all([
      this.customerRepository.count(),
      this.customerRepository.count({
        where: { status: CustomerStatus.ACTIVE },
      }),
      this.customerRepository.count({
        where: { createdAt: MoreThanOrEqual(todayStart) },
      }),
      this.customerRepository.count({
        where: { createdAt: MoreThanOrEqual(weekStart) },
      }),
      this.userRepository.count(),
      this.userRepository.count({
        where: { status: UserStatus.ACTIVE },
      }),
    ]);

    // =========================================================================
    // 5. INTERNAL INVENTORY REQUESTS
    // =========================================================================
    const [pendingRequests, pendingStockIn, pendingStockOut, pendingTransfer] =
      await Promise.all([
        this.requestRepository.count({
          where: { status: RequestStatus.PENDING },
        }),
        this.requestRepository.count({
          where: {
            status: RequestStatus.PENDING,
            requestType: RequestType.STOCK_IN,
          },
        }),
        this.requestRepository.count({
          where: {
            status: RequestStatus.PENDING,
            requestType: RequestType.STOCK_OUT,
          },
        }),
        this.requestRepository.count({
          where: {
            status: RequestStatus.PENDING,
            requestType: RequestType.STOCK_TRANSFER,
          },
        }),
      ]);

    return {
      inventory: {
        totalProducts,
        totalVariants,
        totalStockQuantity: Math.round(totalStockQuantity * 100) / 100,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        lowStockCount,
        outOfStockCount,
        totalWarehouses,
      },
      orders: {
        totalOrders,
        pendingOrders: statusMap.get(CustomerOrderStatus.PENDING_REVIEW) || 0,
        waitingStockOrders:
          statusMap.get(CustomerOrderStatus.WAITING_STOCK) || 0,
        waitingCustomerOrders:
          statusMap.get(CustomerOrderStatus.WAITING_CUSTOMER) || 0,
        confirmedOrders: statusMap.get(CustomerOrderStatus.CONFIRMED) || 0,
        deliveredOrders: statusMap.get(CustomerOrderStatus.DELIVERED) || 0,
        cancelledOrders: statusMap.get(CustomerOrderStatus.CANCELLED) || 0,
        rejectedOrders: statusMap.get(CustomerOrderStatus.REJECTED) || 0,
        todayOrders,
        thisWeekOrders,
        thisMonthOrders,
      },
      revenue: {
        totalRevenue: Math.round(Number(totalRevRaw?.revenue || 0) * 100) / 100,
        todayRevenue: Math.round(Number(todayRevRaw?.revenue || 0) * 100) / 100,
        thisWeekRevenue:
          Math.round(Number(weekRevRaw?.revenue || 0) * 100) / 100,
        thisMonthRevenue:
          Math.round(Number(monthRevRaw?.revenue || 0) * 100) / 100,
        paidRevenue: Math.round(Number(paidRevRaw?.revenue || 0) * 100) / 100,
        unpaidRevenue:
          Math.round(Number(unpaidRevRaw?.revenue || 0) * 100) / 100,
      },
      customers: {
        totalCustomers,
        activeCustomers,
        newCustomersToday,
        newCustomersThisWeek,
      },
      staff: {
        totalStaff,
        activeStaff,
      },
      requests: {
        pendingRequests,
        pendingStockIn,
        pendingStockOut,
        pendingTransfer,
      },
    };
  }

  /**
   * Generates a date-continuous trend array for chart visualization.
   */
  async getSalesTrend(
    days: number = 7,
  ): Promise<{ days: number; trend: DailyTrendItem[] }> {
    const validDays = Math.max(1, Math.min(days, 90));
    const now = new Date();

    // Map of date string -> accumulator
    const trendMap = new Map<string, DailyTrendItem>();

    // Pre-populate all dates in ascending order
    for (let i = validDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      trendMap.set(dateKey, {
        date: dateKey,
        ordersCount: 0,
        revenue: 0,
        itemsSold: 0,
      });
    }

    const startDate = new Date(now.getTime() - validDays * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const orders = await this.orderRepository.find({
      where: {
        createdAt: MoreThanOrEqual(startDate),
      },
      relations: {
        items: true,
      },
    });

    for (const order of orders) {
      if (
        order.status === CustomerOrderStatus.CANCELLED ||
        order.status === CustomerOrderStatus.REJECTED
      ) {
        continue;
      }

      const od = new Date(order.createdAt);
      const year = od.getFullYear();
      const month = String(od.getMonth() + 1).padStart(2, '0');
      const day = String(od.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const existing = trendMap.get(dateKey);
      if (existing) {
        existing.ordersCount += 1;
        existing.revenue =
          Math.round(
            (existing.revenue + Number(order.totalAmount || 0)) * 100,
          ) / 100;

        let itemsCount = 0;
        for (const item of order.items || []) {
          itemsCount += Number(item.requestedQuantity || 0);
        }
        existing.itemsSold += itemsCount;
      }
    }

    return {
      days: validDays,
      trend: Array.from(trendMap.values()),
    };
  }

  /**
   * Computes breakdowns by Order Status and by Order Source.
   */
  async getOrderBreakdowns(): Promise<{
    ordersByStatus: OrderStatusBreakdown[];
    ordersBySource: OrderSourceBreakdown[];
  }> {
    const [statusRaw, sourceRaw] = await Promise.all([
      this.orderRepository
        .createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(o.id)', 'count')
        .groupBy('o.status')
        .getRawMany(),
      this.orderRepository
        .createQueryBuilder('o')
        .select('o.source', 'source')
        .addSelect('COUNT(o.id)', 'count')
        .groupBy('o.source')
        .getRawMany(),
    ]);

    let totalStatus = 0;
    for (const r of statusRaw) {
      totalStatus += Number(r.count || 0);
    }

    const ordersByStatus: OrderStatusBreakdown[] = statusRaw.map((r) => {
      const count = Number(r.count || 0);
      const percentage =
        totalStatus > 0 ? Math.round((count / totalStatus) * 1000) / 10 : 0;
      return {
        status: r.status as CustomerOrderStatus,
        count,
        percentage,
      };
    });

    let totalSource = 0;
    for (const r of sourceRaw) {
      totalSource += Number(r.count || 0);
    }

    const ordersBySource: OrderSourceBreakdown[] = sourceRaw.map((r) => {
      const count = Number(r.count || 0);
      const percentage =
        totalSource > 0 ? Math.round((count / totalSource) * 1000) / 10 : 0;
      return {
        source: r.source || 'UNKNOWN',
        count,
        percentage,
      };
    });

    return {
      ordersByStatus,
      ordersBySource,
    };
  }

  /**
   * Returns top-selling products by units sold and revenue.
   */
  async getTopProducts(limit: number = 10): Promise<TopProductItem[]> {
    const validLimit = Math.max(1, Math.min(limit, 50));

    const topItemsRaw = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.product', 'product')
      .leftJoin('product.category', 'category')
      .select('product.id', 'productId')
      .addSelect('product.code', 'productCode')
      .addSelect('product.name', 'productName')
      .addSelect('product.image', 'image')
      .addSelect('category.name', 'categoryName')
      .addSelect('COALESCE(SUM(item.requested_quantity), 0)', 'unitsSold')
      .addSelect('COALESCE(SUM(item.subtotal), 0)', 'revenue')
      .where('order.status NOT IN (:...excluded)', {
        excluded: [CustomerOrderStatus.CANCELLED, CustomerOrderStatus.REJECTED],
      })
      .groupBy('product.id')
      .addGroupBy('product.code')
      .addGroupBy('product.name')
      .addGroupBy('product.image')
      .addGroupBy('category.name')
      .orderBy('SUM(item.requested_quantity)', 'DESC')
      .limit(validLimit)
      .getRawMany();

    return topItemsRaw.map((r) => ({
      productId: r.productId,
      productCode: r.productCode,
      productName: r.productName,
      image: r.image || null,
      categoryName: r.categoryName || null,
      unitsSold: Number(r.unitsSold || 0),
      revenue: Math.round(Number(r.revenue || 0) * 100) / 100,
    }));
  }

  /**
   * Returns low stock and out-of-stock items requiring inventory action.
   */
  async getLowStockAlerts(limit: number = 10): Promise<LowStockAlertItem[]> {
    const validLimit = Math.max(1, Math.min(limit, 50));

    const products = await this.productRepository.find({
      where: { isActive: true },
      relations: { category: true },
      order: { name: 'ASC' },
    });

    const stockByProductRaw = await this.stockRepository
      .createQueryBuilder('s')
      .select('s.product_id', 'productId')
      .addSelect('COALESCE(SUM(s.quantity), 0)', 'totalStock')
      .groupBy('s.product_id')
      .getRawMany();

    const productStockMap = new Map<string, number>();
    for (const row of stockByProductRaw) {
      productStockMap.set(row.productId, Number(row.totalStock || 0));
    }

    const alerts: LowStockAlertItem[] = [];

    for (const p of products) {
      const currentStock = productStockMap.get(p.id) || 0;
      const minStock = Number(p.minimumStock || 0);

      if (currentStock <= 0) {
        alerts.push({
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          categoryName: p.category?.name || null,
          currentStock: 0,
          minimumStock: minStock,
          status: 'OUT_OF_STOCK',
        });
      } else if (minStock > 0 && currentStock <= minStock) {
        alerts.push({
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          categoryName: p.category?.name || null,
          currentStock,
          minimumStock: minStock,
          status: 'LOW_STOCK',
        });
      }
    }

    // Sort by currentStock ASC (out-of-stock first, then lowest stock)
    alerts.sort((a, b) => a.currentStock - b.currentStock);

    return alerts.slice(0, validLimit);
  }

  /**
   * Returns the most recent customer orders with customer summary and item count.
   */
  async getRecentOrders(limit: number = 10): Promise<RecentOrderItem[]> {
    const validLimit = Math.max(1, Math.min(limit, 50));

    const orders = await this.orderRepository.find({
      relations: {
        customer: true,
        items: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: validLimit,
    });

    return orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      customer: {
        id: o.customer?.id,
        companyName: o.customer?.companyName || null,
        contactName: o.customer?.contactName || null,
        phone: o.customer?.phone || null,
      },
      totalAmount: Number(o.totalAmount || 0),
      status: o.status,
      deliveryStatus: o.deliveryStatus,
      paymentStatus: o.paymentStatus,
      source: o.source,
      itemCount: o.items?.length || 0,
      createdAt: o.createdAt,
    }));
  }

  /**
   * Returns the most recent stock adjustments.
   */
  async getRecentAdjustments(
    limit: number = 10,
  ): Promise<RecentAdjustmentItem[]> {
    const validLimit = Math.max(1, Math.min(limit, 50));

    const adjustments = await this.stockAdjustmentRepository.find({
      relations: {
        product: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: validLimit,
    });

    return adjustments.map((adj) => ({
      id: adj.id,
      productCode: adj.product?.code || 'UNKNOWN',
      productName: adj.product?.name || 'Unknown Product',
      adjustmentType: adj.adjustmentType,
      quantity: Number(adj.quantity || 0),
      reason: adj.reason || 'General Adjustment',
      createdAt: adj.createdAt,
    }));
  }
}
