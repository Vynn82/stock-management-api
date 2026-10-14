import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import {
  ForbiddenException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';

import {
  TelegramAuthService,
  normalizeCompanyName,
  normalizePhoneNumber,
} from './telegram-auth.service';
import { TelegramBotService } from './telegram-bot.service';
import { Customer } from '../entities/customer.entity';
import { CustomerTelegramAccount } from '../entities/customer-telegram-account.entity';
import { CustomerStatus } from '../enums/customer-status.enum';
import { CustomerJwtGuard } from '../guards/customer-jwt.guard';
import { CustomerOrdersService } from '../customer-orders.service';
import * as dotenv from 'dotenv';
dotenv.config();

const TEST_BOT_TOKEN =
  (process.env.TELEGRAM_BOT_TOKEN || '')
    .replace(/^["']|["']$/g, '')
    .trim() || 'test_telegram_bot_token_123456';

function createValidInitData(
  user: any,
  botToken: string = TEST_BOT_TOKEN,
  chatId?: string,
) {
  const params: Record<string, string> = {
    auth_date: Math.floor(Date.now() / 1000).toString(),
    query_id: 'AAHdF6IQAAAAAN0XohD9V_test',
    user: JSON.stringify(user),
  };
  if (chatId) {
    params.chat_instance = chatId;
  }
  const keys = Object.keys(params).sort();
  const dataCheckString = keys.map((k) => `${k}=${params[k]}`).join('\n');
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const searchParams = new URLSearchParams();
  for (const k of keys) {
    searchParams.set(k, params[k]);
  }
  searchParams.set('hash', hash);
  return searchParams.toString();
}

describe('Telegram Customer Registration & Authentication (17 Test Cases)', () => {
  let authService: TelegramAuthService;
  let jwtService: any;
  let customerRepo: any;
  let accountRepo: any;
  let telegramBotService: any;
  let mockManager: any;
  let dataSource: any;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entity, data) => ({ ...data })),
      save: jest.fn((entity, data) =>
        Promise.resolve({ id: data.id || 'gen-uuid', ...data }),
      ),
    };

    dataSource = {
      transaction: jest.fn((cb) => cb(mockManager)),
    };

    customerRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'cust-id', ...data })),
    };

    accountRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'acc-id', ...data })),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-customer-jwt-token'),
      verifyAsync: jest.fn(),
    };

    telegramBotService = {
      sendMessage: jest.fn().mockResolvedValue(true),
      notifyCustomerApproved: jest.fn().mockResolvedValue(undefined),
      notifyCustomerRejected: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'TELEGRAM_BOT_TOKEN') return TEST_BOT_TOKEN;
              return null;
            }),
          },
        },
        { provide: JwtService, useValue: jwtService },
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        {
          provide: getRepositoryToken(CustomerTelegramAccount),
          useValue: accountRepo,
        },
        { provide: TelegramBotService, useValue: telegramBotService },
      ],
    }).compile();

    authService = module.get<TelegramAuthService>(TelegramAuthService);
  });

  // -------------------------------------------------------------
  // Test Case 1: New Telegram user -> REGISTRATION_REQUIRED
  // -------------------------------------------------------------
  it('Case 1: New Telegram user should receive REGISTRATION_REQUIRED', async () => {
    accountRepo.findOne.mockResolvedValue(null);
    const initData = createValidInitData({
      id: 1001,
      first_name: 'John',
      username: 'john_doe',
    });

    const result: any =
      await authService.authenticateTelegramCustomer(initData);

    expect(result.status).toBe('REGISTRATION_REQUIRED');
    expect(result.telegramUser.id).toBe(1001);
    expect(result.telegramUser.first_name).toBe('John');
  });

  // -------------------------------------------------------------
  // Test Case 2: New user registers -> PENDING
  // -------------------------------------------------------------
  it('Case 2: New user registers successfully -> status ACTIVE with access token', async () => {
    const initData = createValidInitData({ id: 1002, first_name: 'Alice' });

    mockManager.findOne.mockImplementation((_entity: any) => {
      // No existing telegram account, phone, or company
      return Promise.resolve(null);
    });
    mockManager.find.mockResolvedValue([]);

    const result: any = await authService.registerCustomer({
      initData,
      companyName: 'Acme Retail',
      contactName: 'Alice Smith',
      phone: '012 345 678',
      address: 'Phnom Penh, Cambodia',
    });

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.accessToken).toBe('mock-customer-jwt-token');
    expect(result.customer.status).toBe(CustomerStatus.ACTIVE);
    expect(result.customer.companyName).toBe('Acme Retail');
  });

  // -------------------------------------------------------------
  // Test Case 3: Same Telegram user registers twice -> Idempotent
  // -------------------------------------------------------------
  it('Case 3: Same Telegram user registers twice -> Idempotent, returns existing active customer', async () => {
    const initData = createValidInitData({ id: 1003, first_name: 'Bob' });
    const existingCustomer = {
      id: 'existing-cust-1003',
      companyName: 'Bob Store',
      contactName: 'Bob',
      phone: '012111222',
      address: 'Street 1',
      status: CustomerStatus.ACTIVE,
      isActive: true,
    };
    const existingAccount = {
      id: 'acc-1003',
      telegramUserId: '1003',
      customer: existingCustomer,
    };

    // When checking existing account inside transaction
    mockManager.findOne.mockResolvedValueOnce(existingAccount);

    const result: any = await authService.registerCustomer({
      initData,
      companyName: 'Bob Store New Name',
      contactName: 'Bob New',
      phone: '012111222',
      address: 'Street 1',
    });

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.customer.id).toBe('existing-cust-1003');
    expect(result.accessToken).toBe('mock-customer-jwt-token');
    // Ensure save was not called to create a duplicate customer
    expect(mockManager.save).not.toHaveBeenCalled();
  });

  it('Case 3b: Legacy PENDING customer registers again -> Auto-activates to ACTIVE with token', async () => {
    const initData = createValidInitData({ id: 1003, first_name: 'Bob' });
    const legacyPendingCustomer = {
      id: 'legacy-cust-1003',
      companyName: 'Bob Store',
      contactName: 'Bob',
      phone: '012111222',
      address: 'Street 1',
      status: CustomerStatus.PENDING,
      isActive: false,
    };
    const existingAccount = {
      id: 'acc-1003',
      telegramUserId: '1003',
      customer: legacyPendingCustomer,
    };

    mockManager.findOne.mockResolvedValueOnce(existingAccount);

    const result: any = await authService.registerCustomer({
      initData,
      companyName: 'Bob Store',
      contactName: 'Bob',
      phone: '012111222',
      address: 'Street 1',
    });

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.customer.id).toBe('legacy-cust-1003');
    expect(result.accessToken).toBe('mock-customer-jwt-token');
    expect(legacyPendingCustomer.status).toBe(CustomerStatus.ACTIVE);
    expect(legacyPendingCustomer.isActive).toBe(true);
    expect(mockManager.save).toHaveBeenCalledWith(
      Customer,
      legacyPendingCustomer,
    );
  });

  // -------------------------------------------------------------
  // Test Case 4: Concurrent registration -> DB unique constraint handled
  // -------------------------------------------------------------
  it('Case 4: Concurrent registration hitting DB unique constraint (23505) is handled gracefully', async () => {
    const initData = createValidInitData({ id: 1004, first_name: 'Charlie' });
    const existingCustomer = {
      id: 'cust-1004',
      companyName: 'Charlie Express',
      status: CustomerStatus.ACTIVE,
      isActive: true,
    };
    const existingAccount = {
      id: 'acc-1004',
      telegramUserId: '1004',
      customer: existingCustomer,
    };

    // 1. Initial check returns null (simulating concurrent race)
    mockManager.findOne.mockResolvedValueOnce(null); // account check
    mockManager.findOne.mockResolvedValueOnce(null); // phone check
    mockManager.find.mockResolvedValueOnce([]); // company check

    // 2. Save throws Postgres unique violation code '23505'
    mockManager.save.mockRejectedValueOnce({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    });

    // 3. Fallback query retrieves existing account
    mockManager.findOne.mockResolvedValueOnce(existingAccount);

    const result = await authService.registerCustomer({
      initData,
      companyName: 'Charlie Express',
      contactName: 'Charlie',
      phone: '012999888',
      address: 'Street 99',
    });

    expect(result.customer.id).toBe('cust-1004');
    expect(result.status).toBe(CustomerStatus.ACTIVE);
  });

  // -------------------------------------------------------------
  // Test Case 5: ACTIVE customer opens Mini App -> Can access ordering
  // -------------------------------------------------------------
  it('Case 5: ACTIVE customer opens Mini App -> Receives access token and profile', async () => {
    const activeCustomer = {
      id: 'cust-active-5',
      companyName: 'Gold Partner Ltd',
      contactName: 'Owner',
      phone: '012333444',
      address: 'Downtown',
      status: CustomerStatus.ACTIVE,
    };
    const activeAccount = {
      id: 'acc-5',
      telegramUserId: '1005',
      customer: activeCustomer,
      telegramUsername: 'gold_partner',
      firstName: 'Gold',
      lastName: 'Partner',
    };

    accountRepo.findOne.mockResolvedValue(activeAccount);
    const initData = createValidInitData({
      id: 1005,
      first_name: 'Gold',
      username: 'gold_partner',
    });

    const result: any =
      await authService.authenticateTelegramCustomer(initData);

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.accessToken).toBe('mock-customer-jwt-token');
    expect(result.customer.id).toBe('cust-active-5');
    expect(result.customer.status).toBe(CustomerStatus.ACTIVE);
  });

  // -------------------------------------------------------------
  // Test Case 6: PENDING customer -> Cannot order (CustomerJwtGuard)
  // -------------------------------------------------------------
  it('Case 6: PENDING customer is rejected by CustomerJwtGuard', async () => {
    const pendingCustomer = {
      id: 'cust-pending-6',
      status: CustomerStatus.PENDING,
    };

    customerRepo.findOne.mockResolvedValue(pendingCustomer);
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'cust-pending-6',
      role: 'CUSTOMER',
      telegramUserId: '1006',
    });

    const guard = new CustomerJwtGuard(jwtService, customerRepo);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-jwt-token' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // -------------------------------------------------------------
  // Test Case 7: REJECTED customer -> Sees rejection reason
  // -------------------------------------------------------------
  it('Case 7: REJECTED customer sees rejection reason when opening Mini App', async () => {
    const rejectedCustomer = {
      id: 'cust-rejected-7',
      companyName: 'Rejected Shop',
      status: CustomerStatus.REJECTED,
      rejectionReason: 'Business registration document invalid',
    };
    const rejectedAccount = {
      id: 'acc-7',
      telegramUserId: '1007',
      customer: rejectedCustomer,
    };

    accountRepo.findOne.mockResolvedValue(rejectedAccount);
    const initData = createValidInitData({ id: 1007, first_name: 'Dave' });

    const result: any =
      await authService.authenticateTelegramCustomer(initData);

    expect(result.status).toBe(CustomerStatus.REJECTED);
    expect(result.rejectionReason).toBe(
      'Business registration document invalid',
    );
    expect(result.customer.rejectionReason).toBe(
      'Business registration document invalid',
    );
  });

  // -------------------------------------------------------------
  // Test Case 8: REJECTED customer re-registers -> Existing customer updated
  // -------------------------------------------------------------
  it('Case 8: REJECTED customer re-registers -> Existing customer updated to ACTIVE, no duplicate created', async () => {
    const initData = createValidInitData({ id: 1008, first_name: 'Eve' });
    const existingRejectedCustomer = {
      id: 'cust-rejected-8',
      companyName: 'Eve Old Shop',
      contactName: 'Eve',
      phone: '012444555',
      address: 'Old Address',
      status: CustomerStatus.REJECTED,
      rejectionReason: 'Address incorrect',
    };
    const existingAccount = {
      id: 'acc-8',
      telegramUserId: '1008',
      customer: existingRejectedCustomer,
    };

    mockManager.findOne.mockResolvedValueOnce(existingAccount);

    const result: any = await authService.registerCustomer({
      initData,
      companyName: 'Eve Updated Enterprise',
      contactName: 'Eve Smith',
      phone: '012444555',
      address: 'New Verified Address, Phnom Penh',
    });

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.accessToken).toBe('mock-customer-jwt-token');
    // Entity was updated, not re-created
    expect(existingRejectedCustomer.companyName).toBe('Eve Updated Enterprise');
    expect(existingRejectedCustomer.address).toBe(
      'New Verified Address, Phnom Penh',
    );
    expect(existingRejectedCustomer.status).toBe(CustomerStatus.ACTIVE);
    expect(existingRejectedCustomer.rejectionReason).toBeNull();
    expect(mockManager.save).toHaveBeenCalledWith(
      Customer,
      existingRejectedCustomer,
    );
  });

  // -------------------------------------------------------------
  // Test Case 9: SUSPENDED customer -> Cannot order
  // -------------------------------------------------------------
  it('Case 9: SUSPENDED customer is rejected by CustomerJwtGuard', async () => {
    const suspendedCustomer = {
      id: 'cust-suspended-9',
      status: CustomerStatus.SUSPENDED,
    };

    customerRepo.findOne.mockResolvedValue(suspendedCustomer);
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'cust-suspended-9',
      role: 'CUSTOMER',
      telegramUserId: '1009',
    });

    const guard = new CustomerJwtGuard(jwtService, customerRepo);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-jwt-token' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // -------------------------------------------------------------
  // Test Case 10: BLOCKED customer -> Cannot order
  // -------------------------------------------------------------
  it('Case 10: BLOCKED customer is rejected by CustomerJwtGuard', async () => {
    const blockedCustomer = {
      id: 'cust-blocked-10',
      status: CustomerStatus.BLOCKED,
    };

    customerRepo.findOne.mockResolvedValue(blockedCustomer);
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'cust-blocked-10',
      role: 'CUSTOMER',
      telegramUserId: '1010',
    });

    const guard = new CustomerJwtGuard(jwtService, customerRepo);
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-jwt-token' },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // -------------------------------------------------------------
  // Test Case 11: Invalid Telegram initData -> Rejected
  // -------------------------------------------------------------
  it('Case 11: Invalid Telegram initData signature is rejected', () => {
    const validData = createValidInitData({ id: 1011, first_name: 'Frank' });
    // Tamper with data by changing user id while keeping original hash
    const tamperedData = validData.replace('1011', '9999');

    expect(() => authService.validateTelegramInitData(tamperedData)).toThrow(
      UnauthorizedException,
    );
  });

  // -------------------------------------------------------------
  // Test Case 12: Customer attempts to access another customerId's order -> Forbidden
  // -------------------------------------------------------------
  it('Case 12: Customer accessing another customer order throws ForbiddenException', async () => {
    const mockOrderRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'ord-123',
        customerId: 'customer-owner-A',
      }),
    };

    const ordersService = new CustomerOrdersService(
      {} as any, // dataSource
      {} as any, // customerRepo
      mockOrderRepo as any,
      {} as any, // itemRepo
      {} as any, // messageRepo
      {} as any, // paymentRepo
      {} as any, // productRepo
      {} as any, // variantRepo
      {} as any, // stockRepo
      {} as any, // warehouseRepo
      {} as any, // telegramBotService
      {} as any, // mailsService
    );

    await expect(
      ordersService.getCustomerOrderById('ord-123', 'intruder-customer-B'),
    ).rejects.toThrow(ForbiddenException);
  });

  // -------------------------------------------------------------
  // Test Case 13: Duplicate phone number -> Warning logged for staff review
  // -------------------------------------------------------------
  it('Case 13: Duplicate phone number logs warning and proceeds with status PENDING', async () => {
    const initData = createValidInitData({ id: 1013, first_name: 'George' });
    const existingPhoneCustomer = {
      id: 'cust-phone-owner',
      companyName: 'Original Phone Owner Co',
      phone: '012345678',
    };

    mockManager.findOne
      .mockResolvedValueOnce(null) // account check
      .mockResolvedValueOnce(existingPhoneCustomer); // duplicate phone check
    mockManager.find.mockResolvedValueOnce([]); // company check

    const loggerWarnSpy = jest.spyOn((authService as any).logger, 'warn');

    const result: any = await authService.registerCustomer({
      initData,
      companyName: 'Different Company',
      contactName: 'George',
      phone: '012-345-678', // Same normalized phone
      address: 'Address',
    });

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.accessToken).toBe('mock-customer-jwt-token');
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[DUPLICATE WARNING] Registering customer has phone',
      ),
    );
  });

  // -------------------------------------------------------------
  // Test Case 14: Possible duplicate company name -> Warning logged for staff review
  // -------------------------------------------------------------
  it('Case 14: Similar company name logs warning and proceeds with status ACTIVE', async () => {
    const initData = createValidInitData({ id: 1014, first_name: 'Helen' });
    const existingCustomers = [
      { id: 'cust-comp-owner', companyName: 'Mega Star Trading Co., Ltd.' },
    ];

    mockManager.findOne
      .mockResolvedValueOnce(null) // account check
      .mockResolvedValueOnce(null); // phone check
    mockManager.find.mockResolvedValueOnce(existingCustomers); // company check

    const loggerWarnSpy = jest.spyOn((authService as any).logger, 'warn');

    const result: any = await authService.registerCustomer({
      initData,
      companyName: 'Mega Star Trading Ltd', // Normalized name matches
      contactName: 'Helen',
      phone: '012999000',
      address: 'Address',
    });

    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.accessToken).toBe('mock-customer-jwt-token');
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[DUPLICATE WARNING] Registering customer company',
      ),
    );
  });

  // -------------------------------------------------------------
  // Test Case 15: Staff approves customer -> PENDING -> ACTIVE
  // -------------------------------------------------------------
  it('Case 15: Staff approves customer -> PENDING -> ACTIVE and sets isActive true', async () => {
    const pendingCustomer = {
      id: 'cust-to-approve-15',
      companyName: 'To Approve Co',
      status: CustomerStatus.PENDING,
      isActive: false,
      telegramAccounts: [{ telegramChatId: 'chat-15', telegramUserId: '1015' }],
    };

    customerRepo.findOne.mockResolvedValue(pendingCustomer);

    const result = await authService.approveCustomer(
      'cust-to-approve-15',
      'staff-1',
    );

    expect(result.success).toBe(true);
    expect(result.customer.status).toBe(CustomerStatus.ACTIVE);
    expect(pendingCustomer.status).toBe(CustomerStatus.ACTIVE);
    expect(pendingCustomer.isActive).toBe(true);
    expect(customerRepo.save).toHaveBeenCalledWith(pendingCustomer);
  });

  // -------------------------------------------------------------
  // Test Case 16: Staff rejects customer -> PENDING -> REJECTED with reason
  // -------------------------------------------------------------
  it('Case 16: Staff rejects customer -> PENDING -> REJECTED with reason', async () => {
    const pendingCustomer = {
      id: 'cust-to-reject-16',
      companyName: 'To Reject Co',
      status: CustomerStatus.PENDING,
      isActive: true,
      rejectionReason: null as string | null,
      telegramAccounts: [{ telegramChatId: 'chat-16', telegramUserId: '1016' }],
    };

    customerRepo.findOne.mockResolvedValue(pendingCustomer);

    const result = await authService.rejectCustomer(
      'cust-to-reject-16',
      'staff-1',
      'Incomplete tax document',
    );

    expect(result.success).toBe(true);
    expect(result.customer.status).toBe(CustomerStatus.REJECTED);
    expect(pendingCustomer.status).toBe(CustomerStatus.REJECTED);
    expect(pendingCustomer.rejectionReason).toBe('Incomplete tax document');
    expect(pendingCustomer.isActive).toBe(false);
    expect(customerRepo.save).toHaveBeenCalledWith(pendingCustomer);
  });

  // -------------------------------------------------------------
  // Test Case 17: Approval/Rejection Telegram notification sent
  // -------------------------------------------------------------
  it('Case 17: Approval and rejection send Telegram notifications to customer', async () => {
    const customer = {
      id: 'cust-notif-17',
      companyName: 'Notif Co',
      status: CustomerStatus.PENDING,
      isActive: false,
      telegramAccounts: [{ telegramChatId: 'chat-17', telegramUserId: '1017' }],
    };

    customerRepo.findOne.mockResolvedValue(customer);

    // 1. Test Approval notification
    await authService.approveCustomer('cust-notif-17', 'staff-1');
    expect(telegramBotService.notifyCustomerApproved).toHaveBeenCalledWith(
      'chat-17',
      'Notif Co',
    );

    // 2. Test Rejection notification
    customer.status = CustomerStatus.PENDING;
    await authService.rejectCustomer(
      'cust-notif-17',
      'staff-1',
      'Business license expired',
    );
    expect(telegramBotService.notifyCustomerRejected).toHaveBeenCalledWith(
      'chat-17',
      'Business license expired',
    );
  });

  // -------------------------------------------------------------
  // Test Case 18: Staff customer search supports telegram username, id, phone, name
  // -------------------------------------------------------------
  it('Case 18: searchCustomersForStaff queries database and returns matching customer', async () => {
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'cust-search-1',
          companyName: 'ABC Store',
          contactName: 'John Doe',
          phone: '012345678',
          address: 'Street 123',
          status: CustomerStatus.ACTIVE,
          isActive: true,
          telegramAccounts: [
            {
              id: 'acc-1',
              telegramUserId: '987654321',
              telegramChatId: 'chat-1',
              telegramUsername: 'john123',
              firstName: 'John',
              lastName: 'Doe',
            },
          ],
          createdAt: new Date(),
        },
      ]),
    };

    customerRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue(mockQueryBuilder);

    const result = await authService.searchCustomersForStaff('@john123');

    expect(customerRepo.createQueryBuilder).toHaveBeenCalledWith('customer');
    expect(mockQueryBuilder.where).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cust-search-1');
    expect(result[0].canOrder).toBe(true);
    expect(result[0].telegramAccounts[0].telegramUsername).toBe('john123');
  });

  // Helper unit tests
  describe('Helper functions', () => {
    it('normalizes Cambodian phone numbers consistently', () => {
      expect(normalizePhoneNumber('+85512345678')).toBe('012345678');
      expect(normalizePhoneNumber('+855012345678')).toBe('012345678');
      expect(normalizePhoneNumber('012 345 678')).toBe('012345678');
      expect(normalizePhoneNumber('012-345-678')).toBe('012345678');
    });

    it('normalizes company names for duplicate matching', () => {
      expect(normalizeCompanyName('Acme Trading Co., Ltd.')).toBe(
        normalizeCompanyName('Acme Trading Limited'),
      );
    });
  });
});
