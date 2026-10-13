import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { Role } from '../src/roles/role.entity';
import { UserRole } from '../src/users/entities/user-role.entity';
import { Customer } from '../src/customer-orders/entities/customer.entity';
import { CustomerTelegramAccount } from '../src/customer-orders/entities/customer-telegram-account.entity';
import { Product } from '../src/products/entities/product.entity';
import { Warehouse } from '../src/warehouses/entities/warehouse.entity';
import { Stock } from '../src/stock/entities/stock.entity';
import { TelegramBotService } from '../src/customer-orders/telegram/telegram-bot.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

async function testOrderAcceptAndReject() {
  console.log('================================================================');
  console.log('📦 TESTING STAFF ORDER ACCEPT & REJECT FLOWS');
  console.log('================================================================\n');

  let notifyConfirmedCalled = false;
  let notifyRejectedCalled = false;
  let rejectedReasonReceived = '';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TelegramBotService)
    .useValue({
      notifyOrderCreated: () => Promise.resolve(),
      notifyStaffOrderCreated: () => Promise.resolve(),
      notifyStaffQuestion: () => Promise.resolve(),
      notifyOrderConfirmed: (chatId: string, orderNo: string) => {
        notifyConfirmedCalled = true;
        console.log(`  📣 [TELEGRAM SENT] notifyOrderConfirmed to chat ${chatId} for order #${orderNo}`);
        return Promise.resolve();
      },
      notifyOrderRejected: (chatId: string, orderNo: string, reason?: string) => {
        notifyRejectedCalled = true;
        rejectedReasonReceived = reason || '';
        console.log(`  📣 [TELEGRAM SENT] notifyOrderRejected to chat ${chatId} for order #${orderNo} (Reason: ${reason})`);
        return Promise.resolve();
      },
      sendMessage: () => Promise.resolve(),
    })
    .compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.init();

  const server = app.getHttpServer();
  const dataSource = app.get(DataSource);

  try {
    // 1. Authenticate Staff
    console.log('▶ [1/4] Authenticating Staff...');
    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository(Role);
    const userRoleRepo = dataSource.getRepository(UserRole);

    const superAdminRole = await roleRepo.findOne({ where: { name: 'SUPER_ADMIN' } });
    let staffUser: User | null = null;
    if (superAdminRole) {
      const userRole = await userRoleRepo.findOne({ where: { roleId: superAdminRole.id } });
      if (userRole) {
        staffUser = await userRepo.findOne({ where: { id: userRole.userId, status: UserStatus.ACTIVE } });
      }
    }
    if (!staffUser) staffUser = await userRepo.findOne({ where: { status: UserStatus.ACTIVE } });
    if (!staffUser) throw new Error('No staff user found');

    staffUser.passwordHash = await bcrypt.hash('Staff@123', 10);
    await userRepo.save(staffUser);

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ staffId: staffUser.staffId, password: 'Staff@123' });
    const staffToken = loginRes.body.accessToken;
    console.log(`  ✅ Staff ${staffUser.staffId} logged in.`);

    // 2. Register Active Customer
    console.log('\n▶ [2/4] Registering Customer (Status is directly ACTIVE)...');
    const custTgId = Date.now().toString().slice(-8);
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '8818101242:AAHZQk1kXxecy6FLyObRoJiwxXne-WOfZMY';
    
    const userJson = JSON.stringify({ id: Number(custTgId), first_name: 'Test', username: `user_${custTgId}` });
    const authDate = Math.floor(Date.now() / 1000).toString();
    const queryId = 'AAHdF_test_' + Date.now();
    const params: Record<string, string> = { auth_date: authDate, query_id: queryId, user: userJson };
    const keys = Object.keys(params).sort();
    const dataCheckString = keys.map((key) => `${key}=${params[key]}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    const urlParams = new URLSearchParams();
    for (const key of keys) urlParams.set(key, params[key]);
    urlParams.set('hash', hash);
    const validInitData = urlParams.toString();

    const regRes = await request(server)
      .post('/customer-auth/register')
      .send({
        initData: validInitData,
        companyName: `Company ${custTgId}`,
        contactName: `Contact ${custTgId}`,
        phone: `012${custTgId.slice(0, 6)}`,
        address: 'Phnom Penh St 200',
      });

    if (regRes.status !== 201 && regRes.status !== 200) {
      throw new Error(`Customer register failed: ${JSON.stringify(regRes.body)}`);
    }
    const customerToken = regRes.body.accessToken;
    console.log(`  ✅ Customer registered directly with status: ${regRes.body.customer.status} (No staff approval required!)`);

    // Ensure warehouse stock
    const warehouse = await dataSource.getRepository(Warehouse).findOne({ where: { isActive: true } });
    const product = await dataSource.getRepository(Product).findOne({ where: { isActive: true } });
    if (!warehouse || !product) throw new Error('Warehouse or product missing');

    const stockRepo = dataSource.getRepository(Stock);
    let stock = await stockRepo.findOne({
      where: { warehouseId: warehouse.id, productId: product.id },
    });
    if (!stock) {
      stock = stockRepo.create({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 50,
      });
    } else {
      stock.quantity = 50;
    }
    await stockRepo.save(stock);

    // 3. Test Staff ACCEPT Order Flow
    console.log('\n▶ [3/4] Customer places Order 1 -> Staff ACCEPTS order...');
    const order1Res = await request(server)
      .post('/customer-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: product.id, quantity: 5 }],
        deliveryAddress: 'Test Location 1',
      });

    if (order1Res.status !== 201) throw new Error(`Create order 1 failed: ${JSON.stringify(order1Res.body)}`);
    const order1Id = order1Res.body.id;
    const order1No = order1Res.body.orderNo;
    console.log(`  ✅ Order 1 created: #${order1No} (Status: ${order1Res.body.status})`);

    // Staff accepts order
    const acceptRes = await request(server)
      .post(`/customer-orders/${order1Id}/accept`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ warehouseCode: warehouse.code });

    if (acceptRes.status !== 200 && acceptRes.status !== 201) {
      throw new Error(`Accept order failed: ${JSON.stringify(acceptRes.body)}`);
    }
    console.log(`  ✅ Staff accepted order. New status: ${acceptRes.body.status}`);
    if (!notifyConfirmedCalled) {
      throw new Error('Telegram notifyOrderConfirmed was NOT triggered!');
    }
    console.log('  ✅ Telegram confirmation notification sent to customer!');

    // 4. Test Staff REJECT Order Flow
    console.log('\n▶ [4/4] Customer places Order 2 -> Staff REJECTS order with reason...');
    const order2Res = await request(server)
      .post('/customer-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: product.id, quantity: 10 }],
        deliveryAddress: 'Test Location 2',
      });

    if (order2Res.status !== 201) throw new Error(`Create order 2 failed: ${JSON.stringify(order2Res.body)}`);
    const order2Id = order2Res.body.id;
    const order2No = order2Res.body.orderNo;
    console.log(`  ✅ Order 2 created: #${order2No} (Status: ${order2Res.body.status})`);

    // Staff rejects order
    const rejectionReason = 'Customer delivery location outside delivery zone';
    const rejectRes = await request(server)
      .post(`/customer-orders/${order2Id}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: rejectionReason });

    if (rejectRes.status !== 200 && rejectRes.status !== 201) {
      throw new Error(`Reject order failed: ${JSON.stringify(rejectRes.body)}`);
    }
    console.log(`  ✅ Staff rejected order. New status: ${rejectRes.body.status}`);
    if (!notifyRejectedCalled || rejectedReasonReceived !== rejectionReason) {
      throw new Error(`Telegram notifyOrderRejected was NOT triggered with correct reason! Reason: ${rejectedReasonReceived}`);
    }
    console.log('  ✅ Telegram rejection notification sent to customer with explanation!');

    console.log('\n================================================================');
    console.log('🎉 BOTH ORDER ACCEPT & ORDER REJECT WITH TELEGRAM ALERTS WORK 100%!');
    console.log('================================================================');
  } finally {
    await app.close();
  }
}

testOrderAcceptAndReject().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
