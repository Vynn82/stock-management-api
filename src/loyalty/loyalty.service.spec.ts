import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { LoyaltyService } from './loyalty.service';
import { LoyaltyTier } from './entities/loyalty-tier.entity';
import {
  LoyaltyConfig,
  LoyaltyDowngradePolicy,
  LoyaltyStackingPolicy,
} from './entities/loyalty-config.entity';
import { Customer } from '../customer-orders/entities/customer.entity';
import { CustomerOrder } from '../customer-orders/entities/customer-order.entity';
import { CustomerOrderItem } from '../customer-orders/entities/customer-order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Category } from '../categories/entities/category.entity';
import { CustomerOrderStatus } from '../customer-orders/enums/customer-order-status.enum';

describe('LoyaltyService Unit Tests', () => {
  let service: LoyaltyService;
  let tierRepo: any;
  let configRepo: any;
  let customerRepo: any;
  let orderRepo: any;
  let itemRepo: any;
  let productRepo: any;
  let variantRepo: any;
  let categoryRepo: any;

  const mockTiers: Partial<LoyaltyTier>[] = [
    {
      id: 'tier-vip',
      name: 'VIP',
      code: 'VIP',
      tierRank: 4,
      minOrders: 10,
      minSpending: 15000,
      discountPercent: 5.0,
      isActive: true,
    },
    {
      id: 'tier-regular',
      name: 'Regular',
      code: 'REGULAR',
      tierRank: 3,
      minOrders: 5,
      minSpending: 7500,
      discountPercent: 3.0,
      isActive: true,
    },
    {
      id: 'tier-returning',
      name: 'Returning',
      code: 'RETURNING',
      tierRank: 2,
      minOrders: 2,
      minSpending: 2000,
      discountPercent: 2.0,
      isActive: true,
    },
    {
      id: 'tier-new',
      name: 'New',
      code: 'NEW',
      tierRank: 1,
      minOrders: 0,
      minSpending: 0,
      discountPercent: 0.0,
      isActive: true,
    },
  ];

  const mockConfig: Partial<LoyaltyConfig> = {
    id: 'config-1',
    isEnabled: true,
    minProfitMarginPercent: 10,
    downgradePolicy: LoyaltyDowngradePolicy.AUTOMATIC,
    gracePeriodDays: 30,
    stackingPolicy: LoyaltyStackingPolicy.DISALLOW_ALL,
    excludedProductIds: ['prod-excluded'],
    excludedCategoryIds: ['cat-excluded'],
  };

  beforeEach(async () => {
    tierRepo = {
      find: jest.fn().mockResolvedValue(mockTiers),
      findOne: jest.fn().mockImplementation(({ where }) => {
        if (where.id) return Promise.resolve(mockTiers.find((t) => t.id === where.id) || null);
        if (where.code) return Promise.resolve(mockTiers.find((t) => t.code === where.code) || null);
        return Promise.resolve(null);
      }),
      save: jest.fn().mockImplementation((val) => Promise.resolve({ id: 'saved-id', ...val })),
      create: jest.fn().mockImplementation((val) => val),
    };

    configRepo = {
      findOne: jest.fn().mockResolvedValue(mockConfig),
      find: jest.fn().mockResolvedValue([mockConfig]),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };

    customerRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
    };

    orderRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    itemRepo = {};

    productRepo = {
      findOne: jest.fn(),
    };

    variantRepo = {
      findOne: jest.fn(),
    };

    categoryRepo = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(LoyaltyTier), useValue: tierRepo },
        { provide: getRepositoryToken(LoyaltyConfig), useValue: configRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(CustomerOrder), useValue: orderRepo },
        { provide: getRepositoryToken(CustomerOrderItem), useValue: itemRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(ProductVariant), useValue: variantRepo },
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  describe('Automatic Tier Assignment (Dual Requirement)', () => {
    it('should assign NEW tier if customer has no orders and $0 spending', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-1',
        loyaltyTier: mockTiers.find((t) => t.code === 'NEW'),
        manualTierOverride: null,
      });
      orderRepo.find.mockResolvedValue([]);

      const profile = await service.calculateCustomerLoyalty('cust-1');
      expect(profile.currentTier.code).toBe('NEW');
      expect(profile.currentTier.discountPercent).toBe(0);
      expect(profile.statistics.completedOrderCount).toBe(0);
      expect(profile.statistics.lifetimeSpending).toBe(0);
    });

    it('should NOT promote to RETURNING if orders >= 2 but spending < $2,000', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-2',
        loyaltyTier: mockTiers.find((t) => t.code === 'NEW'),
        manualTierOverride: null,
      });

      // 2 completed orders totaling $1,500 (below $2,000 threshold)
      orderRepo.find.mockResolvedValue([
        {
          id: 'ord-1',
          totalAmount: 750,
          subtotalAmount: 750,
          loyaltyDiscountAmount: 0,
          createdAt: new Date('2026-01-01'),
          items: [{ productId: 'p1', approvedQuantity: 5, subtotal: 750 }],
        },
        {
          id: 'ord-2',
          totalAmount: 750,
          subtotalAmount: 750,
          loyaltyDiscountAmount: 0,
          createdAt: new Date('2026-01-15'),
          items: [{ productId: 'p1', approvedQuantity: 5, subtotal: 750 }],
        },
      ]);

      const profile = await service.calculateCustomerLoyalty('cust-2');
      expect(profile.statistics.completedOrderCount).toBe(2);
      expect(profile.statistics.lifetimeSpending).toBe(1500);
      // Both criteria required: orders >= 2 AND spending >= 2000. Spending is only 1500, so remains NEW.
      expect(profile.currentTier.code).toBe('NEW');
      expect(profile.progress.nextTier?.code).toBe('RETURNING');
      expect(profile.progress.spendingNeeded).toBe(500);
      expect(profile.progress.ordersNeeded).toBe(0);
    });

    it('should NOT promote to RETURNING if spending >= $2,000 but orders < 2', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-3',
        loyaltyTier: mockTiers.find((t) => t.code === 'NEW'),
        manualTierOverride: null,
      });

      // 1 order with $3,000 spending (spending met, but orders = 1 < 2)
      orderRepo.find.mockResolvedValue([
        {
          id: 'ord-1',
          totalAmount: 3000,
          subtotalAmount: 3000,
          loyaltyDiscountAmount: 0,
          createdAt: new Date('2026-02-01'),
          items: [{ productId: 'p1', approvedQuantity: 10, subtotal: 3000 }],
        },
      ]);

      const profile = await service.calculateCustomerLoyalty('cust-3');
      expect(profile.statistics.completedOrderCount).toBe(1);
      expect(profile.statistics.lifetimeSpending).toBe(3000);
      expect(profile.currentTier.code).toBe('NEW');
      expect(profile.progress.ordersNeeded).toBe(1);
      expect(profile.progress.spendingNeeded).toBe(0);
    });

    it('should assign RETURNING tier when orders >= 2 AND spending >= $2,000', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-4',
        loyaltyTier: mockTiers.find((t) => t.code === 'NEW'),
        manualTierOverride: null,
      });

      orderRepo.find.mockResolvedValue([
        {
          id: 'ord-1',
          totalAmount: 1200,
          subtotalAmount: 1200,
          loyaltyDiscountAmount: 0,
          createdAt: new Date('2026-01-01'),
          items: [{ productId: 'p1', approvedQuantity: 5, subtotal: 1200 }],
        },
        {
          id: 'ord-2',
          totalAmount: 1100,
          subtotalAmount: 1100,
          loyaltyDiscountAmount: 0,
          createdAt: new Date('2026-01-10'),
          items: [{ productId: 'p1', approvedQuantity: 5, subtotal: 1100 }],
        },
      ]);

      const profile = await service.calculateCustomerLoyalty('cust-4');
      expect(profile.statistics.completedOrderCount).toBe(2);
      expect(profile.statistics.lifetimeSpending).toBe(2300);
      expect(profile.currentTier.code).toBe('RETURNING');
      expect(profile.currentTier.discountPercent).toBe(2.0);
    });

    it('should assign VIP tier when orders >= 10 AND spending >= $15,000', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-5',
        loyaltyTier: mockTiers.find((t) => t.code === 'REGULAR'),
        manualTierOverride: null,
      });

      const orders = Array.from({ length: 10 }, (_, i) => ({
        id: `ord-${i}`,
        totalAmount: 1600,
        subtotalAmount: 1600,
        loyaltyDiscountAmount: 0,
        createdAt: new Date(`2026-0${i + 1}-01`),
        items: [{ productId: 'p1', approvedQuantity: 10, subtotal: 1600 }],
      }));

      orderRepo.find.mockResolvedValue(orders);

      const profile = await service.calculateCustomerLoyalty('cust-5');
      expect(profile.statistics.completedOrderCount).toBe(10);
      expect(profile.statistics.lifetimeSpending).toBe(16000);
      expect(profile.currentTier.code).toBe('VIP');
      expect(profile.currentTier.discountPercent).toBe(5.0);
    });
  });


  describe('Discount Management & Margin Floor', () => {
    it('should apply discount to regular product and exclude excludedProductIds', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-vip',
        loyaltyTier: mockTiers.find((t) => t.code === 'VIP'),
        manualTierOverride: null,
      });

      productRepo.findOne.mockImplementation(({ where }) => {
        if (where.id === 'prod-normal') {
          return Promise.resolve({
            id: 'prod-normal',
            name: 'Normal Product',
            sellingPrice: 100,
            costPrice: 50,
            categoryId: 'cat-regular',
          });
        }
        if (where.id === 'prod-excluded') {
          return Promise.resolve({
            id: 'prod-excluded',
            name: 'Excluded Product',
            sellingPrice: 200,
            costPrice: 100,
            categoryId: 'cat-regular',
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.calculateOrderLoyaltyDiscount('cust-vip', [
        { productId: 'prod-normal', quantity: 2 },
        { productId: 'prod-excluded', quantity: 1 },
      ]);

      expect(result.subtotalAmount).toBe(400);

      const normalItem = result.items.find((i) => i.productId === 'prod-normal');
      expect(normalItem?.isExcluded).toBe(false);
      expect(normalItem?.discountPercent).toBe(5);
      expect(normalItem?.discountAmount).toBe(10);

      const excludedItem = result.items.find((i) => i.productId === 'prod-excluded');
      expect(excludedItem?.isExcluded).toBe(true);
      expect(excludedItem?.discountPercent).toBe(0);
      expect(excludedItem?.discountAmount).toBe(0);

      expect(result.loyaltyDiscountAmount).toBe(10);
      expect(result.totalAmount).toBe(390);
    });

    it('should cap discount when product margin is near minProfitMarginPercent floor', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-vip',
        loyaltyTier: mockTiers.find((t) => t.code === 'VIP'),
        manualTierOverride: null,
      });

      productRepo.findOne.mockResolvedValue({
        id: 'prod-tight-margin',
        name: 'Tight Margin Product',
        sellingPrice: 100,
        costPrice: 88,
        categoryId: 'cat-regular',
      });

      const result = await service.calculateOrderLoyaltyDiscount('cust-vip', [
        { productId: 'prod-tight-margin', quantity: 1 },
      ]);

      const item = result.items[0];
      expect(item.isCappedByMargin).toBe(true);
      expect(item.discountPercent).toBe(2.22);
      expect(item.discountAmount).toBe(2.22);
      expect(result.totalAmount).toBe(97.78);
    });
  });

  describe('Manual Admin Override', () => {
    it('should honor active manual override even if customer has 0 orders', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-override',
        loyaltyTier: mockTiers.find((t) => t.code === 'NEW'),
        manualTierOverride: mockTiers.find((t) => t.code === 'VIP'),
        tierOverrideExpiry: null,
        tierOverrideNotes: 'Strategic Partner',
      });
      orderRepo.find.mockResolvedValue([]);

      const profile = await service.calculateCustomerLoyalty('cust-override');
      expect(profile.currentTier.code).toBe('VIP');
      expect(profile.currentTier.discountPercent).toBe(5.0);
      expect(profile.currentTier.isManualOverride).toBe(true);
      expect(profile.currentTier.overrideNotes).toBe('Strategic Partner');
    });

    it('should revert to automatic calculated tier if manual override is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      customerRepo.findOne.mockResolvedValue({
        id: 'cust-expired-override',
        loyaltyTier: mockTiers.find((t) => t.code === 'NEW'),
        manualTierOverride: mockTiers.find((t) => t.code === 'VIP'),
        tierOverrideExpiry: pastDate,
        tierOverrideNotes: 'Expired promotion',
      });
      orderRepo.find.mockResolvedValue([]);

      const profile = await service.calculateCustomerLoyalty('cust-expired-override');
      expect(profile.currentTier.code).toBe('NEW');
      expect(profile.currentTier.isManualOverride).toBe(false);
    });
  });
});
