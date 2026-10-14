import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import { CustomerOrder } from '../customer-orders/entities/customer-order.entity';
import { CustomerOrderItem } from '../customer-orders/entities/customer-order-item.entity';
import { Customer } from '../customer-orders/entities/customer.entity';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { Request } from '../requests/entities/request.entity';
import { CustomerOrderStatus } from '../customer-orders/enums/customer-order-status.enum';
import {
  DeliveryStatus,
  PaymentStatus,
} from '../customer-orders/enums/customer-order-enums';
import { OrderSource } from '../customer-orders/enums/order-source.enum';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockQueryBuilder = (result: any = {}) => ({
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(result),
    getRawMany: jest
      .fn()
      .mockResolvedValue(Array.isArray(result) ? result : [result]),
    getMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
  });

  const mockProductRepo = {
    count: jest.fn().mockResolvedValue(25),
    find: jest.fn().mockResolvedValue([
      {
        id: 'p-1',
        code: 'PROD-001',
        name: 'Product 1',
        minimumStock: 10,
        isActive: true,
        category: { name: 'Cat 1' },
      },
      {
        id: 'p-2',
        code: 'PROD-002',
        name: 'Product 2',
        minimumStock: 5,
        isActive: true,
        category: { name: 'Cat 2' },
      },
    ]),
  };

  const mockVariantRepo = {
    count: jest.fn().mockResolvedValue(10),
  };

  const mockStockRepo = {
    createQueryBuilder: jest
      .fn()
      .mockReturnValue(
        mockQueryBuilder({ totalQuantity: '150', totalValue: '3000' }),
      ),
  };

  const mockOrderRepo = {
    count: jest.fn().mockResolvedValue(5),
    createQueryBuilder: jest.fn().mockReturnValue(
      mockQueryBuilder([
        { status: CustomerOrderStatus.PENDING_REVIEW, count: '3' },
        { status: CustomerOrderStatus.CONFIRMED, count: '2' },
      ]),
    ),
    find: jest.fn().mockResolvedValue([
      {
        id: 'o-1',
        orderNo: 'ORD-001',
        totalAmount: 120.5,
        status: CustomerOrderStatus.CONFIRMED,
        deliveryStatus: DeliveryStatus.PENDING,
        paymentStatus: PaymentStatus.PAID,
        source: OrderSource.MINI_APP,
        createdAt: new Date(),
        customer: {
          id: 'c-1',
          companyName: 'Acme',
          contactName: 'John',
          phone: '012345678',
        },
        items: [{ requestedQuantity: 2 }],
      },
    ]),
  };

  const mockOrderItemRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(
      mockQueryBuilder([
        {
          productId: 'p-1',
          productCode: 'PROD-001',
          productName: 'Product 1',
          image: null,
          categoryName: 'Cat 1',
          unitsSold: '15',
          revenue: '300',
        },
      ]),
    ),
  };

  const mockCustomerRepo = {
    count: jest.fn().mockResolvedValue(12),
  };

  const mockUserRepo = {
    count: jest.fn().mockResolvedValue(4),
  };

  const mockWarehouseRepo = {
    count: jest.fn().mockResolvedValue(2),
  };

  const mockRequestRepo = {
    count: jest.fn().mockResolvedValue(1),
  };

  const mockStockAdjustmentRepo = {
    find: jest.fn().mockResolvedValue([
      {
        id: 'adj-1',
        adjustmentType: 'DECREASE',
        quantity: 2,
        reason: 'Broken bottle',
        createdAt: new Date(),
        product: { code: 'PROD-001', name: 'Product 1' },
      },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: mockVariantRepo,
        },
        { provide: getRepositoryToken(Stock), useValue: mockStockRepo },
        {
          provide: getRepositoryToken(StockAdjustment),
          useValue: mockStockAdjustmentRepo,
        },
        { provide: getRepositoryToken(CustomerOrder), useValue: mockOrderRepo },
        {
          provide: getRepositoryToken(CustomerOrderItem),
          useValue: mockOrderItemRepo,
        },
        { provide: getRepositoryToken(Customer), useValue: mockCustomerRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Warehouse), useValue: mockWarehouseRepo },
        { provide: getRepositoryToken(Request), useValue: mockRequestRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate KPIs correctly', async () => {
    const kpis = await service.getDashboardKpis();
    expect(kpis).toBeDefined();
    expect(kpis.inventory.totalProducts).toBe(25);
    expect(kpis.inventory.totalVariants).toBe(10);
    expect(kpis.inventory.totalWarehouses).toBe(2);
    expect(kpis.customers.totalCustomers).toBe(12);
    expect(kpis.staff.totalStaff).toBe(4);
    expect(kpis.requests.pendingRequests).toBe(1);
  });

  it('should return sales trend with continuous daily sequence', async () => {
    const trendData = await service.getSalesTrend(7);
    expect(trendData.days).toBe(7);
    expect(trendData.trend).toHaveLength(7);
    expect(trendData.trend[0]).toHaveProperty('date');
    expect(trendData.trend[0]).toHaveProperty('ordersCount');
    expect(trendData.trend[0]).toHaveProperty('revenue');
  });

  it('should return top products', async () => {
    const top = await service.getTopProducts(5);
    expect(top).toBeDefined();
    expect(Array.isArray(top)).toBe(true);
    expect(top[0].productCode).toBe('PROD-001');
    expect(top[0].unitsSold).toBe(15);
  });

  it('should return recent orders', async () => {
    const orders = await service.getRecentOrders(5);
    expect(orders).toBeDefined();
    expect(orders).toHaveLength(1);
    expect(orders[0].orderNo).toBe('ORD-001');
    expect(orders[0].customer.companyName).toBe('Acme');
  });

  it('should return unified dashboard summary', async () => {
    const summary = await service.getDashboardSummary({ days: 7, limit: 5 });
    expect(summary).toBeDefined();
    expect(summary.generatedAt).toBeDefined();
    expect(summary.kpis).toBeDefined();
    expect(summary.salesTrend).toHaveLength(7);
    expect(summary.recentOrders).toHaveLength(1);
    expect(summary.recentAdjustments).toHaveLength(1);
  });
});
