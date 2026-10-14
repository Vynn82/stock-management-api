import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockSummary = {
    generatedAt: new Date().toISOString(),
    kpis: {
      inventory: {
        totalProducts: 10,
        totalVariants: 5,
        totalStockQuantity: 100,
        totalStockValue: 1500,
        lowStockCount: 2,
        outOfStockCount: 1,
        totalWarehouses: 2,
      },
      orders: {
        totalOrders: 20,
        pendingOrders: 3,
        waitingStockOrders: 1,
        waitingCustomerOrders: 1,
        confirmedOrders: 10,
        deliveredOrders: 4,
        cancelledOrders: 1,
        rejectedOrders: 0,
        todayOrders: 2,
        thisWeekOrders: 10,
        thisMonthOrders: 20,
      },
      revenue: {
        totalRevenue: 5000,
        todayRevenue: 200,
        thisWeekRevenue: 1500,
        thisMonthRevenue: 5000,
        paidRevenue: 4000,
        unpaidRevenue: 1000,
      },
      customers: {
        totalCustomers: 15,
        activeCustomers: 14,
        newCustomersToday: 1,
        newCustomersThisWeek: 4,
      },
      staff: { totalStaff: 5, activeStaff: 5 },
      requests: {
        pendingRequests: 2,
        pendingStockIn: 1,
        pendingStockOut: 1,
        pendingTransfer: 0,
      },
    },
    salesTrend: [],
    ordersByStatus: [],
    ordersBySource: [],
    topProducts: [],
    lowStockAlerts: [],
    recentOrders: [],
    recentAdjustments: [],
  };

  const mockDashboardService = {
    getDashboardSummary: jest.fn().mockResolvedValue(mockSummary),
    getDashboardKpis: jest.fn().mockResolvedValue(mockSummary.kpis),
    getSalesTrend: jest.fn().mockResolvedValue({ days: 7, trend: [] }),
    getOrderBreakdowns: jest
      .fn()
      .mockResolvedValue({ ordersByStatus: [], ordersBySource: [] }),
    getTopProducts: jest.fn().mockResolvedValue([]),
    getLowStockAlerts: jest.fn().mockResolvedValue([]),
    getRecentOrders: jest.fn().mockResolvedValue([]),
    getRecentAdjustments: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return unified dashboard summary from getDashboard', async () => {
    const res = await controller.getDashboard({ days: 7, limit: 10 });
    expect(res).toEqual(mockSummary);
    expect(service.getDashboardSummary).toHaveBeenCalledWith({
      days: 7,
      limit: 10,
    });
  });

  it('should return unified dashboard summary from getSummary alias', async () => {
    const res = await controller.getSummary({ days: 7, limit: 10 });
    expect(res).toEqual(mockSummary);
  });

  it('should return KPIs from getKpis', async () => {
    const res = await controller.getKpis();
    expect(res).toEqual(mockSummary.kpis);
    expect(service.getDashboardKpis).toHaveBeenCalled();
  });

  it('should return sales trend from getSalesTrend', async () => {
    const res = await controller.getSalesTrend(14);
    expect(res).toEqual({ days: 7, trend: [] });
    expect(service.getSalesTrend).toHaveBeenCalledWith(14);
  });

  it('should return order breakdowns', async () => {
    const res = await controller.getOrdersBreakdown();
    expect(res).toEqual({ ordersByStatus: [], ordersBySource: [] });
  });

  it('should return top products', async () => {
    const res = await controller.getTopProducts(5);
    expect(res).toEqual([]);
    expect(service.getTopProducts).toHaveBeenCalledWith(5);
  });

  it('should return low stock alerts', async () => {
    const res = await controller.getLowStock(5);
    expect(res).toEqual([]);
    expect(service.getLowStockAlerts).toHaveBeenCalledWith(5);
  });

  it('should return recent orders', async () => {
    const res = await controller.getRecentOrders(5);
    expect(res).toEqual([]);
    expect(service.getRecentOrders).toHaveBeenCalledWith(5);
  });

  it('should return recent adjustments', async () => {
    const res = await controller.getRecentAdjustments(5);
    expect(res).toEqual([]);
    expect(service.getRecentAdjustments).toHaveBeenCalledWith(5);
  });
});
