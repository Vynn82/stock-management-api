import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CustomerOrdersService } from './customer-orders.service';
import { Customer } from './entities/customer.entity';
import { CustomerOrder } from './entities/customer-order.entity';
import { CustomerOrderItem } from './entities/customer-order-item.entity';
import { CustomerOrderMessage } from './entities/customer-order-message.entity';
import { CustomerOrderPayment } from './entities/customer-order-payment.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { TelegramAuthService } from './telegram/telegram-auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MailsService } from '../mails/mails.service';
import { CustomerOrderStatus } from './enums/customer-order-status.enum';
import { CustomerStatus } from './enums/customer-status.enum';
import { OrderSource } from './enums/order-source.enum';
import { DeliveryStatus, PaymentStatus } from './enums/customer-order-enums';
import { CustomerResponseType } from './dto/customer-order-actions.dto';

describe('CustomerOrdersService Business Invariant Tests', () => {
  let service: CustomerOrdersService;
  let dataSource: any;
  let customerRepo: any;
  let orderRepo: any;
  let itemRepo: any;
  let messageRepo: any;
  let paymentRepo: any;
  let productRepo: any;
  let variantRepo: any;
  let stockRepo: any;
  let warehouseRepo: any;
  let telegramBotService: any;
  let telegramAuthService: any;
  let mailsService: any;
  let loyaltyService: any;

  beforeEach(async () => {
    dataSource = {
      transaction: jest.fn((cb) => cb(dataSource.manager)),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn((entity, data) => ({ ...data })),
        save: jest.fn((entity, data) =>
          Promise.resolve({ id: 'saved-id', ...data }),
        ),
        createQueryBuilder: jest.fn(),
      },
    };

    customerRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    orderRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    itemRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    messageRepo = {
      create: jest.fn((e) => e),
      save: jest.fn((e) => Promise.resolve(e)),
    };
    paymentRepo = {
      create: jest.fn((e) => e),
      save: jest.fn((e) => Promise.resolve(e)),
    };
    productRepo = { findOne: jest.fn() };
    variantRepo = { findOne: jest.fn() };
    stockRepo = { findOne: jest.fn(), save: jest.fn() };
    warehouseRepo = { findOne: jest.fn() };

    telegramBotService = {
      sendMessage: jest.fn().mockResolvedValue(true),
      notifyOrderCreated: jest.fn().mockResolvedValue(undefined),
      notifyStaffQuestion: jest.fn().mockResolvedValue(undefined),
      notifyOrderConfirmed: jest.fn().mockResolvedValue(undefined),
      notifyStockAllocated: jest.fn().mockResolvedValue(undefined),
      notifyOrderProcessing: jest.fn().mockResolvedValue(undefined),
      notifyOutForDelivery: jest.fn().mockResolvedValue(undefined),
      notifyOrderDelivered: jest.fn().mockResolvedValue(undefined),
      notifyPaymentReceived: jest.fn().mockResolvedValue(undefined),
      notifyOrderCompleted: jest.fn().mockResolvedValue(undefined),
      notifyOrderRejected: jest.fn().mockResolvedValue(undefined),
      notifyStaffOrderCreated: jest.fn().mockResolvedValue(undefined),
    };

    telegramAuthService = {
      reverseGeocode: jest.fn().mockImplementation((lat, lng) =>
        Promise.resolve({
          formattedAddress: `Mock Address St 101 (${lat}, ${lng})`,
          latitude: lat,
          longitude: lng,
          province: 'Phnom Penh',
          district: 'Chamkarmon',
          commune: 'Tonle Bassac',
        }),
      ),
      searchLocation: jest.fn().mockResolvedValue([]),
    };

    mailsService = {
      createMail: jest.fn().mockResolvedValue({}),
    };

    loyaltyService = {
      calculateOrderLoyaltyDiscount: jest.fn().mockImplementation((customerId, items) => {
        const subtotal = items.reduce((sum: number, i: any) => sum + (i.quantity * 10), 0);
        return Promise.resolve({
          tierId: null,
          tierName: null,
          loyaltyDiscountPercent: 0,
          subtotalAmount: subtotal,
          loyaltyDiscountAmount: 0,
          totalAmount: subtotal,
          items: items.map((i: any) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            originalUnitPrice: 10,
            unitPrice: 10,
            discountPercent: 0,
            discountAmount: 0,
            isExcluded: false,
            subtotal: i.quantity * 10,
          })),
        });
      }),
      calculateCustomerLoyalty: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerOrdersService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(CustomerOrder), useValue: orderRepo },
        { provide: getRepositoryToken(CustomerOrderItem), useValue: itemRepo },
        {
          provide: getRepositoryToken(CustomerOrderMessage),
          useValue: messageRepo,
        },
        {
          provide: getRepositoryToken(CustomerOrderPayment),
          useValue: paymentRepo,
        },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(ProductVariant), useValue: variantRepo },
        { provide: getRepositoryToken(Stock), useValue: stockRepo },
        { provide: getRepositoryToken(Warehouse), useValue: warehouseRepo },
        { provide: TelegramBotService, useValue: telegramBotService },
        { provide: TelegramAuthService, useValue: telegramAuthService },
        { provide: MailsService, useValue: mailsService },
        {
          provide: NotificationsService,
          useValue: { notifyNewCustomerOrder: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: LoyaltyService, useValue: loyaltyService },
      ],
    }).compile();

    service = module.get<CustomerOrdersService>(CustomerOrdersService);
  });

  describe('Rule 9: Strict Quantity Invariant', () => {
    it('should reject confirmation if approved + waiting > requested', async () => {
      const mockOrder = {
        id: 'ord-1',
        items: [
          {
            id: 'item-1',
            productId: 'p-1',
            requestedQuantity: 100,
            approvedQuantity: 0,
            waitingQuantity: 0,
          },
        ],
      };

      dataSource.manager.findOne.mockResolvedValueOnce(mockOrder);

      await expect(
        service.confirmCustomQuantities('ord-1', 'staff-1', [
          {
            itemId: 'item-1',
            approvedQuantity: 80,
            waitingQuantity: 40, // 80 + 40 = 120 > 100
          },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept confirmation if approved + waiting <= requested', async () => {
      const mockOrder = {
        id: 'ord-1',
        status: CustomerOrderStatus.PENDING_REVIEW,
        items: [
          {
            id: 'item-1',
            productId: 'p-1',
            warehouseId: 'w-1',
            requestedQuantity: 100,
            approvedQuantity: 0,
            waitingQuantity: 0,
          },
        ],
      };

      const mockStock = { id: 's-1', quantity: 60 };

      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === CustomerOrder) return Promise.resolve(mockOrder);
        return Promise.resolve(null);
      });

      const queryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockStock),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.confirmCustomQuantities('ord-1', 'staff-1', [
        {
          itemId: 'item-1',
          approvedQuantity: 60,
          waitingQuantity: 40, // 60 + 40 = 100 <= 100
          warehouseId: 'w-1',
        },
      ]);

      expect(mockStock.quantity).toBe(0); // 60 - 60
      expect(mockOrder.status).toBe(CustomerOrderStatus.CONFIRMED);
    });

    it('should set order to WAITING_STOCK when approved is 0 and waiting is > 0', async () => {
      const mockOrder = {
        id: 'ord-waiting-1',
        status: CustomerOrderStatus.PENDING_REVIEW,
        items: [
          {
            id: 'item-w1',
            productId: 'p-1',
            requestedQuantity: 50,
            approvedQuantity: 0,
            waitingQuantity: 0,
          },
        ],
      };

      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === CustomerOrder) return Promise.resolve(mockOrder);
        return Promise.resolve(null);
      });

      await service.confirmCustomQuantities('ord-waiting-1', 'staff-1', [
        {
          itemId: 'item-w1',
          approvedQuantity: 0,
          waitingQuantity: 50,
        },
      ]);

      expect(mockOrder.status).toBe(CustomerOrderStatus.WAITING_STOCK);
    });
  });

  describe('Rule 14: Enough Stock Acceptance', () => {
    it('should confirm order when warehouse has enough stock', async () => {
      const mockOrder = {
        id: 'ord-2',
        orderNo: 'ORD-20261004-1001',
        telegramChatId: '12345',
        status: CustomerOrderStatus.PENDING_REVIEW,
        items: [
          {
            id: 'item-2',
            productId: 'p-2',
            requestedQuantity: 50,
            approvedQuantity: 0,
            waitingQuantity: 0,
          },
        ],
      };

      const mockWarehouse = { id: 'w-1', code: 'MAIN' };
      const mockStock = { id: 's-2', quantity: 100 };

      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === CustomerOrder) return Promise.resolve(mockOrder);
        if (entity === Warehouse) return Promise.resolve(mockWarehouse);
        return Promise.resolve(null);
      });

      const queryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockStock),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.acceptOrder('ord-2', 'staff-1');

      expect(mockStock.quantity).toBe(50); // 100 - 50
      expect(mockOrder.status).toBe(CustomerOrderStatus.CONFIRMED);
      expect(mockOrder.items[0].approvedQuantity).toBe(50);
      expect(mockOrder.items[0].waitingQuantity).toBe(0);
      expect(telegramBotService.notifyOrderConfirmed).toHaveBeenCalledWith(
        '12345',
        mockOrder.orderNo,
      );
    });
  });

  describe('Rule 15: Not Enough Stock - Ask Customer', () => {
    it('should transition status to WAITING_CUSTOMER and notify via Telegram with options', async () => {
      const mockOrder = {
        id: 'ord-3',
        orderNo: 'ORD-20261004-1002',
        telegramChatId: '12345',
        status: CustomerOrderStatus.PENDING_REVIEW,
        items: [{ id: 'item-3', requestedQuantity: 100 }],
      };

      orderRepo.findOne.mockResolvedValue(mockOrder);

      await service.askCustomer('ord-3', 'staff-1', {
        question: 'We only have 50 available. Do you want 50?',
        proposedQuantity: 50,
      });

      expect(mockOrder.status).toBe(CustomerOrderStatus.WAITING_CUSTOMER);
      expect(telegramBotService.notifyStaffQuestion).toHaveBeenCalledWith(
        '12345',
        'ord-3',
        mockOrder.orderNo,
        'We only have 50 available. Do you want 50?',
        50,
        100,
        undefined,
      );
    });
  });

  describe('Customer Choice: Wait for All Stock', () => {
    it('should set order to WAITING_STOCK, approvedQuantity to 0, waitingQuantity to requested, not deduct stock, and notify customer', async () => {
      const mockOrder = {
        id: 'ord-wait-all',
        orderNo: 'ORD-20261005-2001',
        customerId: 'cust-1',
        telegramChatId: '12345',
        status: CustomerOrderStatus.WAITING_CUSTOMER,
        customer: { contactName: 'John', firstName: 'John' },
        items: [
          {
            id: 'item-200',
            requestedQuantity: 200,
            approvedQuantity: 0,
            waitingQuantity: 0,
            status: 'PENDING_REVIEW',
          },
        ],
      };

      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === CustomerOrder) return Promise.resolve(mockOrder);
        return Promise.resolve(null);
      });

      await service.handleCustomerResponse('ord-wait-all', 'cust-1', {
        responseType: CustomerResponseType.WAIT_STOCK,
        message: 'Chose to wait for all 200 units',
      });

      expect(mockOrder.status).toBe(CustomerOrderStatus.WAITING_STOCK);
      expect(mockOrder.items[0].approvedQuantity).toBe(0);
      expect(mockOrder.items[0].waitingQuantity).toBe(200);
      expect(mockOrder.items[0].status).toBe('WAITING_STOCK');
      expect(dataSource.manager.save).toHaveBeenCalledWith(
        CustomerOrder,
        mockOrder,
      );
      expect(telegramBotService.sendMessage).toHaveBeenCalledWith(
        '12345',
        expect.stringContaining(
          'You chose to wait for all 200 units. Your order #ORD-20261005-2001 is queued and will be fulfilled as soon as stock arrives.',
        ),
      );
    });
  });

  describe('Rule 16: Customer Free-Text Replies', () => {
    it('should never modify stock or quantity directly upon customer free-text reply', async () => {
      const mockOrder = {
        id: 'ord-4',
        orderNo: 'ORD-20261004-1003',
        customerId: 'cust-1',
        telegramChatId: '12345',
        status: CustomerOrderStatus.WAITING_CUSTOMER,
        customer: { firstName: 'ABC Partner' },
        items: [
          {
            id: 'item-4',
            requestedQuantity: 100,
            approvedQuantity: 0,
            waitingQuantity: 0,
          },
        ],
      };

      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === CustomerOrder) return Promise.resolve(mockOrder);
        return Promise.resolve(null);
      });

      await service.handleCustomerResponse('ord-4', 'cust-1', {
        responseType: 'MESSAGE' as any,
        message: 'Can you give me 30 instead?',
      });

      // Status should remain or wait for staff review
      expect(mockOrder.items[0].approvedQuantity).toBe(0);
      expect(mockOrder.items[0].waitingQuantity).toBe(0);
      expect(mockOrder.items[0].requestedQuantity).toBe(100);
      // Staff mail/notification was sent
      expect(mailsService.createMail).toHaveBeenCalled();
    });
  });

  describe('Rule 12: Cash on Delivery & Order Lifecycle', () => {
    it('should decouple delivery status from payment status until cash is collected', async () => {
      const mockOrder = {
        id: 'ord-5',
        orderNo: 'ORD-20261004-1004',
        status: CustomerOrderStatus.CONFIRMED,
        deliveryStatus: DeliveryStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        totalAmount: 150.0,
        telegramChatId: '12345',
      };

      orderRepo.findOne.mockResolvedValue(mockOrder);

      // 1. Process
      await service.processOrder('ord-5', 'staff-1');
      expect(mockOrder.status).toBe(CustomerOrderStatus.PROCESSING);

      // 2. Out for delivery
      await service.outForDelivery('ord-5', 'staff-1');
      expect(mockOrder.status).toBe(CustomerOrderStatus.OUT_FOR_DELIVERY);
      expect(mockOrder.deliveryStatus).toBe(DeliveryStatus.OUT_FOR_DELIVERY);

      // 3. Delivered
      await service.markDelivered('ord-5', 'staff-1');
      expect(mockOrder.status).toBe(CustomerOrderStatus.DELIVERED);
      expect(mockOrder.deliveryStatus).toBe(DeliveryStatus.DELIVERED);
      expect(mockOrder.paymentStatus).toBe(PaymentStatus.UNPAID); // Still unpaid!

      // 4. Customer pays cash upon delivery
      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === CustomerOrder) return Promise.resolve(mockOrder);
        return Promise.resolve(null);
      });

      await service.recordCashPayment('ord-5', 'staff-1', {
        amount: 150.0,
        remark: 'Received $150 cash from partner recipient',
      });

      expect(mockOrder.paymentStatus).toBe(PaymentStatus.PAID);
      expect(mockOrder.status).toBe(CustomerOrderStatus.COMPLETED);
    });
  });

  describe('Staff-Created Orders for Existing Customers', () => {
    it('should reject staff order if customer does not exist', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createOrderForStaff('staff-1', {
          customerId: 'non-existent-id',
          items: [{ productId: 'prod-1', quantity: 5 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject staff order if customer is not ACTIVE', async () => {
      customerRepo.findOne.mockResolvedValue({
        id: 'cust-pending',
        status: CustomerStatus.PENDING,
        isActive: false,
      });

      await expect(
        service.createOrderForStaff('staff-1', {
          customerId: 'cust-pending',
          items: [{ productId: 'prod-1', quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create confirmed order with immediate stock allocation and notify customer', async () => {
      const activeCustomer = {
        id: 'cust-active',
        companyName: 'Acme Supermarket',
        address: '123 Main St',
        status: CustomerStatus.ACTIVE,
        isActive: true,
        telegramUserId: 'tg-123',
        telegramChatId: 'chat-123',
        telegramAccounts: [
          {
            id: 'acc-1',
            telegramUserId: 'tg-123',
            telegramChatId: 'chat-123',
          },
        ],
      };

      const mockWarehouse = {
        id: 'wh-1',
        name: 'Central Warehouse',
        code: 'WH-MAIN',
        isActive: true,
      };

      const mockProduct = {
        id: 'prod-1',
        name: 'Wireless Mouse',
        sellingPrice: 15.0,
        isActive: true,
      };

      const mockStock = {
        id: 'stock-1',
        productId: 'prod-1',
        warehouseId: 'wh-1',
        quantity: 20,
      };

      customerRepo.findOne.mockResolvedValue(activeCustomer);

      const mockStockQueryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockStock),
      };

      dataSource.manager.createQueryBuilder.mockReturnValue(
        mockStockQueryBuilder,
      );

      dataSource.manager.findOne.mockImplementation(
        (entity: any, _options: any) => {
          if (entity === Warehouse) return Promise.resolve(mockWarehouse);
          if (entity === Product) return Promise.resolve(mockProduct);
          if (entity === CustomerOrder) {
            return Promise.resolve({
              id: 'ord-staff-1',
              orderNo: 'ORD-20261004-9999',
              status: CustomerOrderStatus.CONFIRMED,
              source: OrderSource.STAFF,
              createdByStaffId: 'staff-user-1',
              totalAmount: 75.0,
              items: [],
            });
          }
          return Promise.resolve(null);
        },
      );

      const result = await service.createOrderForStaff('staff-user-1', {
        customerId: 'cust-active',
        items: [{ productId: 'prod-1', quantity: 5 }],
      });

      // Stock was decremented (20 - 5 = 15)
      expect(mockStock.quantity).toBe(15);
      expect(dataSource.manager.save).toHaveBeenCalledWith(Stock, mockStock);

      // Telegram notification sent
      expect(telegramBotService.notifyStaffOrderCreated).toHaveBeenCalledWith(
        'chat-123',
        expect.stringMatching(/^ORD-/),
        75.0,
        1,
        '123 Main St',
        'saved-id',
      );

      expect(result).not.toBeNull();
      expect(result!.source).toBe(OrderSource.STAFF);
      expect(result!.status).toBe(CustomerOrderStatus.CONFIRMED);
    });

    it('should reverse-geocode coordinates and record location details when staff provides coordinates', async () => {
      const mockCustomer = {
        id: 'cust-geo',
        status: CustomerStatus.ACTIVE,
        isActive: true,
        address: 'Old customer address',
        telegramUserId: 'tg-geo',
        telegramAccounts: [{ telegramUserId: 'tg-geo', telegramChatId: 'chat-geo' }],
      };

      const mockWarehouse = { id: 'wh-1', code: 'WH-MAIN', name: 'Main WH', isActive: true };
      const mockProduct = {
        id: 'prod-geo',
        name: 'Geo Product',
        sellingPrice: 50.0,
        isActive: true,
      };
      const mockStock = { id: 'stk-geo', quantity: 10 };

      customerRepo.findOne.mockResolvedValue(mockCustomer);

      const mockStockQueryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockStock),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(mockStockQueryBuilder);

      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === Warehouse) return Promise.resolve(mockWarehouse);
        if (entity === Product) return Promise.resolve(mockProduct);
        if (entity === CustomerOrder) {
          return Promise.resolve({
            id: 'ord-geo-1',
            orderNo: 'ORD-20261004-8888',
            deliveryAddress: 'Mock Address St 101 (11.5564, 104.9282)',
            latitude: 11.5564,
            longitude: 104.9282,
            province: 'Phnom Penh',
            district: 'Chamkarmon',
            commune: 'Tonle Bassac',
            status: CustomerOrderStatus.CONFIRMED,
            source: OrderSource.STAFF,
            createdByStaffId: 'staff-user-1',
            totalAmount: 100.0,
            items: [],
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.createOrderForStaff('staff-user-1', {
        customerId: 'cust-geo',
        latitude: 11.5564,
        longitude: 104.9282,
        items: [{ productId: 'prod-geo', quantity: 2 }],
      });

      expect(telegramAuthService.reverseGeocode).toHaveBeenCalledWith(11.5564, 104.9282);
      expect(result.deliveryAddress).toBe('Mock Address St 101 (11.5564, 104.9282)');
      expect(result.latitude).toBe(11.5564);
      expect(result.longitude).toBe(104.9282);
      expect(result.province).toBe('Phnom Penh');
      expect(result.district).toBe('Chamkarmon');
      expect(result.commune).toBe('Tonle Bassac');
    });
  });

  describe('Customer In-Stock Ordering Requirement', () => {
    const mockCustomer = {
      id: 'cust-instock-1',
      companyName: 'Store 1',
      status: CustomerStatus.ACTIVE,
      isActive: true,
      telegramAccounts: [],
    };
    const mockProduct = {
      id: 'prod-stock-1',
      name: 'Wireless Mouse',
      sellingPrice: 25.0,
      isActive: true,
    };

    beforeEach(() => {
      customerRepo.findOne.mockResolvedValue(mockCustomer);
      loyaltyService.calculateOrderLoyaltyDiscount.mockResolvedValue({
        subtotalAmount: 25.0,
        loyaltyDiscountPercent: 0,
        loyaltyDiscountAmount: 0,
        totalAmount: 25.0,
        tierId: null,
        tierName: 'New Customer',
        items: [],
      });
    });

    it('should reject customer order if product is out of stock (stock is 0)', async () => {
      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === Product) return Promise.resolve(mockProduct);
        return Promise.resolve(null);
      });

      const mockStockQuery = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(mockStockQuery);

      await expect(
        service.createOrder('cust-instock-1', {
          items: [{ productId: 'prod-stock-1', quantity: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject customer order if requested quantity exceeds available stock', async () => {
      dataSource.manager.findOne.mockImplementation((entity: any) => {
        if (entity === Product) return Promise.resolve(mockProduct);
        return Promise.resolve(null);
      });

      const mockStockQuery = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ quantity: 2 }]),
      };
      dataSource.manager.createQueryBuilder.mockReturnValue(mockStockQuery);

      await expect(
        service.createOrder('cust-instock-1', {
          items: [{ productId: 'prod-stock-1', quantity: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
