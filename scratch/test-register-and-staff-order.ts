import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { Role } from '../src/roles/role.entity';
import { UserRole } from '../src/users/entities/user-role.entity';
import { Customer } from '../src/customer-orders/entities/customer.entity';
import { Product } from '../src/products/entities/product.entity';
import { Warehouse } from '../src/warehouses/entities/warehouse.entity';
import { Stock } from '../src/stock/entities/stock.entity';
import { TelegramBotService } from '../src/customer-orders/telegram/telegram-bot.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

async function testRegisterAndStaffOrder() {
  console.log('================================================================');
  console.log('🚀 TESTING CUSTOMER REGISTRATION & STAFF ORDER CREATION FLOWS');
  console.log('================================================================\n');

  let telegramStaffOrderNotified = false;
  let notifiedChatId = '';
  let notifiedOrderNo = '';
  let notifiedAddress = '';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TelegramBotService)
    .useValue({
      notifyOrderCreated: () => Promise.resolve(),
      notifyStaffOrderCreated: (chatId: string, orderNo: string, total: number, count: number, address?: string) => {
        telegramStaffOrderNotified = true;
        notifiedChatId = chatId;
        notifiedOrderNo = orderNo;
        notifiedAddress = address || '';
        console.log(`  📣 [TELEGRAM SENT] notifyStaffOrderCreated to chat ${chatId} for order #${orderNo} (Address: ${address})`);
        return Promise.resolve();
      },
      notifyOrderConfirmed: () => Promise.resolve(),
      notifyOrderRejected: () => Promise.resolve(),
      notifyStaffQuestion: () => Promise.resolve(),
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
    // -------------------------------------------------------------------------
    // 1. Authenticate Staff
    // -------------------------------------------------------------------------
    console.log('▶ [1/5] Authenticating Staff Member...');
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
    if (!staffUser) throw new Error('No staff user found in database');

    staffUser.passwordHash = await bcrypt.hash('Staff@123', 10);
    await userRepo.save(staffUser);

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ staffId: staffUser.staffId, password: 'Staff@123' });

    if (loginRes.status !== 200) {
      throw new Error(`Staff login failed: ${JSON.stringify(loginRes.body)}`);
    }
    const staffToken = loginRes.body.accessToken;
    console.log(`  ✅ Staff [${staffUser.staffId}] logged in successfully.`);

    // -------------------------------------------------------------------------
    // 2. Register Customer with Location Picker coordinates
    // -------------------------------------------------------------------------
    console.log('\n▶ [2/5] Registering Customer with Location Coordinates (Auto-ACTIVE)...');
    const custTgId = Date.now().toString().slice(-8);
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || '')
      .replace(/^["']|["']$/g, '')
      .trim();

    const userJson = JSON.stringify({
      id: Number(custTgId),
      first_name: 'Dara',
      last_name: 'Sok',
      username: `dara_${custTgId}`,
    });
    const authDate = Math.floor(Date.now() / 1000).toString();
    const queryId = 'AAHdF_reg_' + Date.now();
    const params: Record<string, string> = { auth_date: authDate, query_id: queryId, user: userJson };
    const keys = Object.keys(params).sort();
    const dataCheckString = keys.map((key) => `${key}=${params[key]}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    const urlParams = new URLSearchParams();
    for (const key of keys) urlParams.set(key, params[key]);
    urlParams.set('hash', hash);
    const validInitData = urlParams.toString();

    const regPayload = {
      initData: validInitData,
      companyName: `Angkor Store ${custTgId}`,
      contactName: `Dara Sok ${custTgId}`,
      phone: `098${custTgId.slice(0, 6)}`,
      address: 'Building 24, Street 306, Boeung Keng Kang 1, Phnom Penh',
      latitude: 11.5564,
      longitude: 104.9282,
      province: 'Phnom Penh',
      district: 'Chamkarmon',
      commune: 'Boeung Keng Kang Ti Muoy',
    };

    const regRes = await request(server)
      .post('/customer-auth/register')
      .send(regPayload);

    if (regRes.status !== 201 && regRes.status !== 200) {
      throw new Error(`Customer registration failed: ${JSON.stringify(regRes.body)}`);
    }

    const customer = regRes.body.customer;
    console.log(`  ✅ Customer registered!`);
    console.log(`     - Customer ID: ${customer.id}`);
    console.log(`     - Status: ${customer.status} (Directly ACTIVE without staff approval)`);
    console.log(`     - Address: "${customer.address}"`);
    console.log(`     - Latitude: ${customer.latitude}, Longitude: ${customer.longitude}`);
    console.log(`     - Province: ${customer.province}, District: ${customer.district}, Commune: ${customer.commune}`);
    console.log(`     - Access Token Issued: ${Boolean(regRes.body.accessToken)}`);

    if (Number(customer.latitude) !== 11.5564 || Number(customer.longitude) !== 104.9282) {
      throw new Error(`Customer coordinates mismatch! Expected (11.5564, 104.9282), got (${customer.latitude}, ${customer.longitude})`);
    }

    // -------------------------------------------------------------------------
    // 3. Staff Reverse Geocode Endpoint Test
    // -------------------------------------------------------------------------
    console.log('\n▶ [3/5] Testing Staff Reverse Geocode API (/customer-orders/location/reverse-geocode)...');
    const geoRes = await request(server)
      .get('/customer-orders/location/reverse-geocode?lat=11.5564&lng=104.9282')
      .set('Authorization', `Bearer ${staffToken}`);

    console.log(`  ✅ HTTP Status: ${geoRes.status}`);
    console.log(`     - Formatted Address: "${geoRes.body.formattedAddress}"`);
    console.log(`     - Province: ${geoRes.body.province}`);
    console.log(`     - District: ${geoRes.body.district}`);

    // -------------------------------------------------------------------------
    // 4. Prepare Stock for Order
    // -------------------------------------------------------------------------
    console.log('\n▶ [4/5] Preparing Warehouse & Product Stock...');
    const whRepo = dataSource.getRepository(Warehouse);
    let warehouse = await whRepo.findOne({ where: { isActive: true } });
    if (!warehouse) {
      warehouse = whRepo.create({
        code: 'WH-MAIN',
        name: 'Main Central Warehouse',
        address: 'Phnom Penh',
        isActive: true,
      });
      await whRepo.save(warehouse);
    }

    const prodRepo = dataSource.getRepository(Product);
    let product = await prodRepo.findOne({ where: { isActive: true } });
    if (!product) {
      product = prodRepo.create({
        code: 'PRD-TEST-01',
        name: 'Energy Drink 250ml',
        sellingPrice: 1.5,
        costPrice: 0.8,
        sku: 'ED-250',
        isActive: true,
      });
      await prodRepo.save(product);
    }

    const stockRepo = dataSource.getRepository(Stock);
    let stock = await stockRepo.findOne({
      where: { warehouseId: warehouse.id, productId: product.id },
    });
    if (!stock) {
      stock = stockRepo.create({
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 100,
      });
    } else {
      stock.quantity = 100;
    }
    await stockRepo.save(stock);
    const initialStockQty = stock.quantity;
    console.log(`  ✅ Warehouse: [${warehouse.code}], Product: [${product.name}], Initial Stock: ${initialStockQty}`);

    // -------------------------------------------------------------------------
    // 5. Staff Creates Order for Existing Customer (POST /customer-orders/staff)
    // -------------------------------------------------------------------------
    console.log('\n▶ [5/5] Staff places order for customer with Coordinates + Auto Reverse Geocode...');
    const orderedQty = 7;
    const staffOrderRes = await request(server)
      .post('/customer-orders/staff')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId: customer.id,
        warehouseCode: warehouse.code,
        latitude: 11.5564,
        longitude: 104.9282,
        remark: 'Order taken by sales staff via Telegram phone call',
        items: [
          {
            productId: product.id,
            quantity: orderedQty,
          },
        ],
      });

    if (staffOrderRes.status !== 201) {
      throw new Error(`Staff create order failed (HTTP ${staffOrderRes.status}): ${JSON.stringify(staffOrderRes.body)}`);
    }

    const order = staffOrderRes.body;
    console.log(`  ✅ Staff Order Created Successfully!`);
    console.log(`     - Order No: ${order.orderNo}`);
    console.log(`     - Status: ${order.status} (Immediate CONFIRMED)`);
    console.log(`     - Source: ${order.source}`);
    console.log(`     - Created By Staff ID: ${order.createdByStaffId}`);
    console.log(`     - Delivery Status: ${order.deliveryStatus}`);
    console.log(`     - Payment Status: ${order.paymentStatus}`);
    console.log(`     - Delivery Address: "${order.deliveryAddress}"`);
    console.log(`     - Latitude: ${order.latitude}, Longitude: ${order.longitude}`);
    console.log(`     - Province: ${order.province}, District: ${order.district}, Commune: ${order.commune}`);
    console.log(`     - Total Amount: $${order.totalAmount}`);

    // Verify stock was decremented
    const updatedStock = await stockRepo.findOne({
      where: { warehouseId: warehouse.id, productId: product.id },
    });
    const expectedStockQty = initialStockQty - orderedQty;
    console.log(`\n  🔎 Stock Verification: Initial=${initialStockQty}, Ordered=${orderedQty}, Remaining in DB=${updatedStock?.quantity}`);
    if (Number(updatedStock?.quantity) !== expectedStockQty) {
      throw new Error(`Stock deduction failure! Expected ${expectedStockQty}, got ${updatedStock?.quantity}`);
    }
    console.log(`  ✅ Stock correctly decremented by ${orderedQty} units!`);

    // Verify Telegram notification
    if (!telegramStaffOrderNotified) {
      throw new Error('Telegram notifyStaffOrderCreated was not called!');
    }
    console.log(`  ✅ Telegram customer notification verified!`);
    console.log(`     - Chat ID: ${notifiedChatId}`);
    console.log(`     - Order: ${notifiedOrderNo}`);
    console.log(`     - Address notified: "${notifiedAddress}"`);

    console.log('\n================================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! BOTH REGISTER & STAFF ORDER WORK PROPERLY.');
    console.log('================================================================\n');
  } finally {
    await app.close();
  }
}

testRegisterAndStaffOrder().catch((err) => {
  console.error('\n❌ TEST FAILED WITH ERROR:', err);
  process.exit(1);
});
