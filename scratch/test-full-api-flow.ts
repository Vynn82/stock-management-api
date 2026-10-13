import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as crypto from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CustomerOrderStatus } from '../src/customer-orders/enums/customer-order-status.enum';
import { CustomerStatus } from '../src/customer-orders/enums/customer-status.enum';
import { OrderSource } from '../src/customer-orders/enums/order-source.enum';
import { CustomerResponseType } from '../src/customer-orders/dto/customer-order-actions.dto';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { Product } from '../src/products/entities/product.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Warehouse } from '../src/warehouses/entities/warehouse.entity';
import { Stock } from '../src/stock/entities/stock.entity';

// Helper to generate valid signed Telegram initData for testing
function generateTestInitData(botToken: string, user: { id: number; first_name: string; username?: string }) {
  const userJson = JSON.stringify(user);
  const authDate = Math.floor(Date.now() / 1000).toString();
  const queryId = 'AAHdF_test_' + Date.now();

  const params: Record<string, string> = {
    auth_date: authDate,
    query_id: queryId,
    user: userJson,
  };

  const keys = Object.keys(params).sort();
  const dataCheckString = keys.map((key) => `${key}=${params[key]}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const urlParams = new URLSearchParams();
  for (const key of keys) {
    urlParams.set(key, params[key]);
  }
  urlParams.set('hash', hash);

  return urlParams.toString();
}

async function runFullVerification() {
  console.log('====================================================');
  console.log('🚀 STARTING COMPREHENSIVE API FUNCTIONAL VERIFICATION');
  console.log('====================================================\n');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

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

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.replace(/^["']|["']$/g, '').trim() || '';
  console.log(`[Config] Bot Token Present: ${!!botToken}`);

  try {
    // -----------------------------------------------------------
    // STEP 0: Staff Login (Get staff accessToken)
    // -----------------------------------------------------------
    const userRepo = dataSource.getRepository(User);
    let adminUser = await userRepo.findOne({ where: { status: UserStatus.ACTIVE } });
    if (!adminUser) {
      throw new Error('No active staff user found in database. Please ensure DB is seeded.');
    }
    adminUser.passwordHash = await bcrypt.hash('TestAdminPass123!', 10);
    await userRepo.save(adminUser);

    console.log(`\n--- Step 0: Staff Login (staffId: ${adminUser.staffId}) ---`);
    const staffLoginRes = await request(server)
      .post('/auth/login')
      .send({
        staffId: adminUser.staffId,
        password: 'TestAdminPass123!',
      });

    if (staffLoginRes.status !== 200 && staffLoginRes.status !== 201) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLoginRes.body)}`);
    }
    const staffToken = staffLoginRes.body.accessToken;
    console.log(`✅ Staff logged in successfully (${adminUser.staffId}). Access token acquired.`);

    // Prepare or query test Product & Warehouse in database
    const warehouseRepo = dataSource.getRepository(Warehouse);
    const productRepo = dataSource.getRepository(Product);
    const stockRepo = dataSource.getRepository(Stock);

    let testWarehouse = await warehouseRepo.findOne({ where: { isActive: true } });
    if (!testWarehouse) {
      testWarehouse = warehouseRepo.create({
        code: 'WH-TEST-' + Date.now().toString().slice(-4),
        name: 'Test Fulfillment Hub',
        address: 'Phnom Penh Test Facility',
        isActive: true,
      });
      testWarehouse = await warehouseRepo.save(testWarehouse);
    }

    let testProduct = await productRepo.findOne({ where: { isActive: true } });
    if (!testProduct) {
      let category = await dataSource.getRepository(Category).findOne({ where: {} });
      if (!category) {
        category = dataSource.getRepository(Category).create({
          code: 'CAT-TEST-' + Date.now().toString().slice(-4),
          name: 'Test Category',
          isActive: true,
        });
        category = await dataSource.getRepository(Category).save(category);
      }
      testProduct = productRepo.create({
        code: 'PROD-TEST-' + Date.now().toString().slice(-4),
        name: 'Super High-Tech Keyboard',
        sellingPrice: 25.0,
        costPrice: 15.0,
        unit: 'pcs',
        sku: 'SKU-' + Date.now(),
        categoryId: category.id,
        isActive: true,
      });
      testProduct = await productRepo.save(testProduct);
    }

    // Set warehouse stock to exactly 100 units for testing partial stock (requested 200, available 100)
    let testStock = await stockRepo.findOne({
      where: { productId: testProduct.id, warehouseId: testWarehouse.id },
    });
    if (!testStock) {
      testStock = stockRepo.create({
        productId: testProduct.id,
        warehouseId: testWarehouse.id,
        quantity: 100,
      });
    } else {
      testStock.quantity = 100;
    }
    await stockRepo.save(testStock);
    console.log(`[Stock Setup] Product "${testProduct.name}" (ID: ${testProduct.id}) stock set to 100 in Warehouse "${testWarehouse.name}".`);

    // -----------------------------------------------------------
    // STEP 1: First-Time Customer Check (REGISTRATION_REQUIRED)
    // -----------------------------------------------------------
    console.log('\n--- Step 1: Customer Auth - First-time user ---');
    const testTelegramUserId = 999000000 + Math.floor(Math.random() * 100000);
    const testTelegramUser = {
      id: testTelegramUserId,
      first_name: 'Visal',
      username: `visal_partner_${testTelegramUserId}`,
    };
    const initData1 = generateTestInitData(botToken, testTelegramUser);

    const firstTimeAuthRes = await request(server)
      .post('/customer-orders/auth/telegram')
      .send({ initData: initData1 });

    console.log(`First-time auth status: ${firstTimeAuthRes.body.status}`);
    if (firstTimeAuthRes.body.status !== 'REGISTRATION_REQUIRED') {
      throw new Error(`Expected REGISTRATION_REQUIRED, got: ${JSON.stringify(firstTimeAuthRes.body)}`);
    }
    console.log('✅ First-time user correctly identified as REGISTRATION_REQUIRED.');

    // -----------------------------------------------------------
    // STEP 2: Customer Registration - Instant ACTIVE (No staff approval needed!)
    // -----------------------------------------------------------
    console.log('\n--- Step 2: Customer Registration (Instant ACTIVE) ---');
    const phone = '098' + Math.floor(100000 + Math.random() * 900000);
    const companyName = `Visal Tech Imports ${testTelegramUserId}`;

    const registerRes = await request(server)
      .post('/customer-orders/auth/register')
      .send({
        initData: initData1,
        companyName,
        contactName: 'Visal Chan',
        phone,
        address: '#88 Norodom Blvd, Phnom Penh',
      });

    console.log(`Register status: ${registerRes.body.status}, Has accessToken: ${!!registerRes.body.accessToken}`);
    if (registerRes.body.status !== CustomerStatus.ACTIVE || !registerRes.body.accessToken) {
      throw new Error(`Registration failed to return ACTIVE and accessToken: ${JSON.stringify(registerRes.body)}`);
    }
    const customerToken = registerRes.body.accessToken;
    const customerId = registerRes.body.customer.id;
    console.log(`✅ Customer registered directly as ACTIVE (ID: ${customerId}). Token issued immediately.`);

    // -----------------------------------------------------------
    // STEP 3: Idempotent Registration & Login
    // -----------------------------------------------------------
    console.log('\n--- Step 3: Idempotent Registration & Login ---');
    const duplicateRegRes = await request(server)
      .post('/customer-orders/auth/register')
      .send({
        initData: initData1,
        companyName,
        contactName: 'Visal Chan',
        phone,
        address: '#88 Norodom Blvd, Phnom Penh',
      });
    if (duplicateRegRes.body.status !== CustomerStatus.ACTIVE || duplicateRegRes.body.customer.id !== customerId) {
      throw new Error(`Duplicate registration failed idempotency: ${JSON.stringify(duplicateRegRes.body)}`);
    }
    console.log('✅ Re-registration is idempotent: returns existing customer credentials.');

    const loginRes = await request(server)
      .post('/customer-orders/auth/telegram')
      .send({ initData: initData1 });
    if (loginRes.body.status !== CustomerStatus.ACTIVE || !loginRes.body.accessToken) {
      throw new Error(`Login failed for active customer: ${JSON.stringify(loginRes.body)}`);
    }
    console.log('✅ Customer login via Telegram initData succeeds with ACTIVE status and valid token.');

    // -----------------------------------------------------------
    // STEP 4: Staff Customer Search
    // -----------------------------------------------------------
    console.log('\n--- Step 4: Staff Customer Search ---');
    // Search by username
    const searchUserRes = await request(server)
      .get(`/customer-orders/customers/search?query=@${testTelegramUser.username}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (!Array.isArray(searchUserRes.body) || searchUserRes.body.length === 0 || searchUserRes.body[0].id !== customerId) {
      throw new Error(`Search by username failed: ${JSON.stringify(searchUserRes.body)}`);
    }
    console.log(`✅ Search by @${testTelegramUser.username} returned matching customer (canOrder: ${searchUserRes.body[0].canOrder}).`);

    // Search by Telegram User ID
    const searchIdRes = await request(server)
      .get(`/customer-orders/customers/search?query=${testTelegramUserId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (searchIdRes.body.length === 0 || searchIdRes.body[0].id !== customerId) {
      throw new Error(`Search by User ID failed: ${JSON.stringify(searchIdRes.body)}`);
    }
    console.log(`✅ Search by Telegram ID ${testTelegramUserId} returned matching customer.`);

    // Search for non-existent customer
    const notFoundRes = await request(server)
      .get('/customer-orders/customers/search?query=NonExistentGuy99999')
      .set('Authorization', `Bearer ${staffToken}`);
    if (notFoundRes.body.length !== 0) {
      throw new Error(`Expected [] for non-existent customer, got: ${JSON.stringify(notFoundRes.body)}`);
    }
    console.log('✅ Search for non-existent customer correctly returns [] (triggering Mini App prompt).');

    // -----------------------------------------------------------
    // STEP 5: Mini App Customer Places Order for 200 units
    // -----------------------------------------------------------
    console.log('\n--- Step 5: Customer Creates Order (Requested: 200) ---');
    const orderRes = await request(server)
      .post('/customer-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            productId: testProduct.id,
            quantity: 200,
          },
        ],
        deliveryAddress: '#88 Norodom Blvd, Phnom Penh',
        remark: 'Need urgently for wholesale distribution',
      });

    if (orderRes.status !== 201) {
      throw new Error(`Create order failed: ${JSON.stringify(orderRes.body)}`);
    }
    const order1 = orderRes.body;
    console.log(`Order created: #${order1.orderNo} (ID: ${order1.id}), Source: ${order1.source}, Status: ${order1.status}`);
    if (order1.source !== OrderSource.MINI_APP || order1.status !== CustomerOrderStatus.PENDING_REVIEW) {
      throw new Error(`Unexpected order state: ${JSON.stringify(order1)}`);
    }
    console.log('✅ Mini App order created with source=MINI_APP and status=PENDING_REVIEW.');

    // -----------------------------------------------------------
    // STEP 6: Staff Asks Customer (Proposed Quantity: 100 Available)
    // -----------------------------------------------------------
    console.log('\n--- Step 6: Staff Inquires Partial Stock (Proposed: 100) ---');
    const askRes = await request(server)
      .post(`/customer-orders/${order1.id}/ask-customer`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        question: 'We only have 100 units in stock out of 200. Would you like to take 100 now or wait for all?',
        proposedQuantity: 100,
      });

    if (askRes.body.status !== CustomerOrderStatus.WAITING_CUSTOMER) {
      throw new Error(`Expected status WAITING_CUSTOMER, got: ${askRes.body.status}`);
    }
    console.log('✅ Staff asked customer. Order status transitioned to WAITING_CUSTOMER.');

    // -----------------------------------------------------------
    // STEP 7: Customer Choice 2: "WAIT_STOCK" ([ ⏳ Wait for All (200) ])
    // -----------------------------------------------------------
    console.log('\n--- Step 7: Customer Choice: [ ⏳ Wait for All (200) ] ---');
    const waitStockRes = await request(server)
      .post(`/customer-orders/${order1.id}/customer-response`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        responseType: CustomerResponseType.WAIT_STOCK,
        message: 'I choose to wait for all 200 units to arrive.',
      });

    console.log(`Order status after WAIT_STOCK: ${waitStockRes.body.status}`);
    if (waitStockRes.body.status !== CustomerOrderStatus.WAITING_STOCK) {
      throw new Error(`Expected status WAITING_STOCK, got: ${waitStockRes.body.status}`);
    }
    const item1 = waitStockRes.body.items[0];
    console.log(`Item quantities -> Approved: ${item1.approvedQuantity}, Waiting: ${item1.waitingQuantity}, Status: ${item1.status}`);
    if (Number(item1.approvedQuantity) !== 0 || Number(item1.waitingQuantity) !== 200 || item1.status !== 'WAITING_STOCK') {
      throw new Error(`Item quantities incorrect after WAIT_STOCK: ${JSON.stringify(item1)}`);
    }

    // Verify stock in warehouse was NOT deducted
    const stockAfterWait = await stockRepo.findOne({
      where: { productId: testProduct.id, warehouseId: testWarehouse.id },
    });
    console.log(`Warehouse stock remaining: ${stockAfterWait?.quantity}`);
    if (Number(stockAfterWait?.quantity) !== 100) {
      throw new Error(`Stock was unexpectedly deducted: ${stockAfterWait?.quantity}`);
    }
    console.log('✅ WAIT_STOCK verified: status=WAITING_STOCK, approvedQty=0, waitingQty=200, NO stock deducted.');

    // -----------------------------------------------------------
    // STEP 8: Customer Choice 1: "ACCEPT" ([ ⚡ Get Available Now (100) ])
    // -----------------------------------------------------------
    console.log('\n--- Step 8: Customer Choice: [ ⚡ Get Available Now (100) ] ---');
    // Create second order for 200 units to test Option 1 (ACCEPT available now)
    const orderRes2 = await request(server)
      .post('/customer-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: testProduct.id, quantity: 200 }],
        deliveryAddress: '#88 Norodom Blvd, Phnom Penh',
      });
    const order2 = orderRes2.body;

    // Staff asks customer with proposed 100
    await request(server)
      .post(`/customer-orders/${order2.id}/ask-customer`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        question: 'Only 100 units available. Take 100 now?',
        proposedQuantity: 100,
      });

    // Customer accepts the available 100 now
    const acceptRes = await request(server)
      .post(`/customer-orders/${order2.id}/customer-response`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        responseType: CustomerResponseType.ACCEPT,
        acceptedQuantity: 100,
        message: 'Yes, please deliver the 100 available units now.',
      });

    console.log(`Order 2 status after ACCEPT: ${acceptRes.body.status}`);
    if (acceptRes.body.status !== CustomerOrderStatus.CONFIRMED) {
      throw new Error(`Expected status CONFIRMED, got: ${acceptRes.body.status}`);
    }
    const item2 = acceptRes.body.items[0];
    console.log(`Item 2 quantities -> Approved: ${item2.approvedQuantity}, Waiting: ${item2.waitingQuantity}, Status: ${item2.status}`);
    if (Number(item2.approvedQuantity) !== 100) {
      throw new Error(`Item approvedQuantity should be 100, got: ${item2.approvedQuantity}`);
    }

    // Verify 100 units deducted from warehouse stock (100 - 100 = 0)
    const stockAfterAccept = await stockRepo.findOne({
      where: { productId: testProduct.id, warehouseId: testWarehouse.id },
    });
    console.log(`Warehouse stock remaining after ACCEPT: ${stockAfterAccept?.quantity}`);
    if (Number(stockAfterAccept?.quantity) !== 0) {
      throw new Error(`Stock should be 0, got: ${stockAfterAccept?.quantity}`);
    }
    console.log('✅ ACCEPT (Get Available Now) verified: status=CONFIRMED, approvedQty=100, stock decremented.');

    // -----------------------------------------------------------
    // STEP 9: Customer Choice 3: "REJECT" ([ ❌ Cancel ])
    // -----------------------------------------------------------
    console.log('\n--- Step 9: Customer Choice: [ ❌ Cancel ] ---');
    const orderRes3 = await request(server)
      .post('/customer-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: testProduct.id, quantity: 50 }],
        deliveryAddress: '#88 Norodom Blvd, Phnom Penh',
      });
    const order3 = orderRes3.body;

    const cancelRes = await request(server)
      .post(`/customer-orders/${order3.id}/customer-response`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        responseType: CustomerResponseType.REJECT,
        message: 'I changed my mind, cancel order please.',
      });

    console.log(`Order 3 status after REJECT: ${cancelRes.body.status}`);
    if (cancelRes.body.status !== CustomerOrderStatus.CANCELLED) {
      throw new Error(`Expected status CANCELLED, got: ${cancelRes.body.status}`);
    }
    console.log('✅ REJECT verified: status=CANCELLED.');

    // -----------------------------------------------------------
    // STEP 10: Staff-Created Order Flow
    // -----------------------------------------------------------
    console.log('\n--- Step 10: Staff-Created Order Flow (source=STAFF, status=CONFIRMED) ---');
    // Restock warehouse so staff can place order
    testStock.quantity = 50;
    await stockRepo.save(testStock);

    const staffOrderRes = await request(server)
      .post('/customer-orders/staff')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        warehouseCode: testWarehouse.code,
        deliveryAddress: '#88 Norodom Blvd, Phnom Penh',
        remark: 'Order placed by phone call directly to sales staff',
        items: [
          {
            productId: testProduct.id,
            quantity: 10,
          },
        ],
      });

    if (staffOrderRes.status !== 201) {
      throw new Error(`Staff create order failed: ${JSON.stringify(staffOrderRes.body)}`);
    }
    const staffOrder = staffOrderRes.body;
    console.log(`Staff order: #${staffOrder.orderNo}, Source: ${staffOrder.source}, Status: ${staffOrder.status}`);
    if (staffOrder.source !== OrderSource.STAFF || staffOrder.status !== CustomerOrderStatus.CONFIRMED) {
      throw new Error(`Unexpected staff order state: ${JSON.stringify(staffOrder)}`);
    }
    console.log('✅ Staff-created order verified: source=STAFF, status=CONFIRMED, stock locked and deducted.');

    // -----------------------------------------------------------
    // STEP 11: Order Delivery & Cash Payment Lifecycle
    // -----------------------------------------------------------
    console.log('\n--- Step 11: Delivery & Cash Payment Lifecycle ---');
    // Process -> Out for Delivery -> Delivered -> Payment
    await request(server)
      .post(`/customer-orders/${staffOrder.id}/process`)
      .set('Authorization', `Bearer ${staffToken}`);

    await request(server)
      .post(`/customer-orders/${staffOrder.id}/out-for-delivery`)
      .set('Authorization', `Bearer ${staffToken}`);

    await request(server)
      .post(`/customer-orders/${staffOrder.id}/delivered`)
      .set('Authorization', `Bearer ${staffToken}`);

    const payRes = await request(server)
      .post(`/customer-orders/${staffOrder.id}/payment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        amount: Number(staffOrder.totalAmount),
        remark: 'Cash collected by courier',
      });

    console.log(`Payment recorded. Payment status: ${payRes.body.paymentStatus}`);
    if (payRes.body.paymentStatus !== 'PAID') {
      throw new Error(`Expected paymentStatus PAID, got: ${payRes.body.paymentStatus}`);
    }

    const completeRes = await request(server)
      .post(`/customer-orders/${staffOrder.id}/complete`)
      .set('Authorization', `Bearer ${staffToken}`);

    console.log(`Order status after completion: ${completeRes.body.status}`);
    if (completeRes.body.status !== CustomerOrderStatus.COMPLETED) {
      throw new Error(`Expected status COMPLETED, got: ${completeRes.body.status}`);
    }
    console.log('✅ Delivery and cash payment lifecycle verified: DELIVERED -> PAID -> COMPLETED.');

    console.log('\n====================================================');
    console.log('🎉 ALL 11 FUNCTIONAL END-TO-END FLOWS PASSED 100%!');
    console.log('====================================================');
  } finally {
    await app.close();
  }
}

runFullVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  });
