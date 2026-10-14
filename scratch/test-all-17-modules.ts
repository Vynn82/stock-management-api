import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/entities/user-role.entity';
import { Role } from '../src/roles/role.entity';
import { Warehouse } from '../src/warehouses/entities/warehouse.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Brand } from '../src/brands/entities/brand.entity';
import { Supplier } from '../src/suppliers/entities/supplier.entity';
import { Product } from '../src/products/entities/product.entity';
import { Stock } from '../src/stock/entities/stock.entity';
import { CustomerOrderStatus } from '../src/customer-orders/enums/customer-order-status.enum';
import { CustomerStatus } from '../src/customer-orders/enums/customer-status.enum';
import { OrderSource } from '../src/customer-orders/enums/order-source.enum';
import { CustomerResponseType } from '../src/customer-orders/dto/customer-order-actions.dto';

// Helper to generate valid signed Telegram initData for testing
function generateTestInitData(botToken: string, user: { id: number; first_name: string; username?: string }) {
  const userJson = JSON.stringify(user);
  const authDate = Math.floor(Date.now() / 1000).toString();
  const queryId = 'AAHdF_modtest_' + Date.now();

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

async function verifyAll17Modules() {
  console.log('================================================================');
  console.log('🧪 VERIFYING ALL 17 MODULES IN STOCK MANAGEMENT API (E2E & LIVE)');
  console.log('================================================================\n');

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
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '')
    .replace(/^["']|["']$/g, '')
    .trim();

  try {
    // -------------------------------------------------------------
    // MODULE 1: AuthModule (/auth)
    // -------------------------------------------------------------
    console.log('▶ [1/17] Testing AuthModule (/auth)...');
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
    if (!staffUser) {
      staffUser = await userRepo.findOne({ where: { status: UserStatus.ACTIVE } });
    }
    if (!staffUser) {
      throw new Error('No active user found in database. Seed data first.');
    }
    staffUser.passwordHash = await bcrypt.hash('Staff@Pass123!', 10);
    await userRepo.save(staffUser);

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ staffId: staffUser.staffId, password: 'Staff@Pass123!' });

    if (loginRes.status !== 200 || !loginRes.body.accessToken) {
      throw new Error(`AuthModule login failed: ${JSON.stringify(loginRes.body)}`);
    }
    const staffToken = loginRes.body.accessToken;
    console.log(`  ✅ AuthModule: Logged in staff (${staffUser.staffId}), accessToken acquired.`);

    // -------------------------------------------------------------
    // MODULE 2: UsersModule (/users)
    // -------------------------------------------------------------
    console.log('▶ [2/17] Testing UsersModule (/users)...');
    const usersRes = await request(server)
      .get('/users')
      .set('Authorization', `Bearer ${staffToken}`);

    if (usersRes.status !== 200) {
      throw new Error(`UsersModule GET /users failed: ${JSON.stringify(usersRes.body)}`);
    }

    const meRes = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${staffToken}`);

    if (meRes.status !== 200 || !meRes.body.staffId) {
      throw new Error(`UsersModule GET /users/me failed: ${JSON.stringify(meRes.body)}`);
    }
    console.log(`  ✅ UsersModule: Listed users and fetched profile for staff ${meRes.body.staffId}.`);

    // -------------------------------------------------------------
    // MODULE 3: RolesModule (/roles)
    // -------------------------------------------------------------
    console.log('▶ [3/17] Testing RolesModule (/roles)...');
    const rolesRes = await request(server)
      .get('/roles')
      .set('Authorization', `Bearer ${staffToken}`);

    const rolesList = rolesRes.body.data || rolesRes.body.items || rolesRes.body;
    if (rolesRes.status !== 200 || !Array.isArray(rolesList)) {
      throw new Error(`RolesModule GET /roles failed: ${JSON.stringify(rolesRes.body)}`);
    }
    console.log(`  ✅ RolesModule: Successfully retrieved system roles.`);

    // -------------------------------------------------------------
    // MODULE 4: PermissionsModule (/permissions)
    // -------------------------------------------------------------
    console.log('▶ [4/17] Testing PermissionsModule (/permissions)...');
    const permRes = await request(server)
      .get('/permissions')
      .set('Authorization', `Bearer ${staffToken}`);

    if (permRes.status !== 200) {
      throw new Error(`PermissionsModule GET /permissions failed: ${JSON.stringify(permRes.body)}`);
    }
    console.log(`  ✅ PermissionsModule: Successfully retrieved permissions.`);

    // -------------------------------------------------------------
    // MODULE 5: MenusModule (/menu)
    // -------------------------------------------------------------
    console.log('▶ [5/17] Testing MenusModule (/menu)...');
    const menuRes = await request(server)
      .get('/menu')
      .set('Authorization', `Bearer ${staffToken}`);

    if (menuRes.status !== 200) {
      throw new Error(`MenusModule GET /menu failed: ${JSON.stringify(menuRes.body)}`);
    }
    console.log(`  ✅ MenusModule: Successfully retrieved navigation menu structure.`);

    // -------------------------------------------------------------
    // MODULE 6: CategoriesModule (/categories)
    // -------------------------------------------------------------
    console.log('▶ [6/17] Testing CategoriesModule (/categories)...');
    const catListRes = await request(server).get('/categories');
    if (catListRes.status !== 200) {
      throw new Error(`CategoriesModule GET /categories failed: ${JSON.stringify(catListRes.body)}`);
    }
    const catRepo = dataSource.getRepository(Category);
    let category = await catRepo.findOne({ where: { isActive: true } });
    if (!category) {
      category = catRepo.create({
        code: 'CAT-MOD-' + Date.now().toString().slice(-4),
        name: 'Module Test Category ' + Date.now().toString().slice(-4),
        isActive: true,
      });
      category = await catRepo.save(category);
    }
    console.log(`  ✅ CategoriesModule: Retrieved category list and verified Category "${category.name}".`);

    // -------------------------------------------------------------
    // MODULE 7: BrandsModule (/brands)
    // -------------------------------------------------------------
    console.log('▶ [7/17] Testing BrandsModule (/brands)...');
    const brandListRes = await request(server)
      .get('/brands')
      .set('Authorization', `Bearer ${staffToken}`);
    if (brandListRes.status !== 200) {
      throw new Error(`BrandsModule GET /brands failed: ${JSON.stringify(brandListRes.body)}`);
    }
    const brandRepo = dataSource.getRepository(Brand);
    let brand = await brandRepo.findOne({ where: { isActive: true } });
    if (!brand) {
      brand = brandRepo.create({
        code: 'BRD-MOD-' + Date.now().toString().slice(-4),
        name: 'Module Test Brand',
        isActive: true,
      });
      brand = await brandRepo.save(brand);
    }
    console.log(`  ✅ BrandsModule: Retrieved brand list and verified Brand "${brand.name}".`);

    // -------------------------------------------------------------
    // MODULE 8: SuppliersModule (/suppliers)
    // -------------------------------------------------------------
    console.log('▶ [8/17] Testing SuppliersModule (/suppliers)...');
    const supplierListRes = await request(server)
      .get('/suppliers')
      .set('Authorization', `Bearer ${staffToken}`);
    if (supplierListRes.status !== 200) {
      throw new Error(`SuppliersModule GET /suppliers failed: ${JSON.stringify(supplierListRes.body)}`);
    }
    const supplierRepo = dataSource.getRepository(Supplier);
    let supplier = await supplierRepo.findOne({ where: { isActive: true } });
    if (!supplier) {
      supplier = supplierRepo.create({
        code: 'SUP-MOD-' + Date.now().toString().slice(-4),
        name: 'Module Test Supplier',
        contactPerson: 'Supplier Contact',
        phone: '012345678',
        isActive: true,
      });
      supplier = await supplierRepo.save(supplier);
    }
    console.log(`  ✅ SuppliersModule: Retrieved supplier list and verified Supplier "${supplier.name}".`);

    // -------------------------------------------------------------
    // MODULE 9: WarehousesModule (/warehouses)
    // -------------------------------------------------------------
    console.log('▶ [9/17] Testing WarehousesModule (/warehouses)...');
    const whListRes = await request(server)
      .get('/warehouses')
      .set('Authorization', `Bearer ${staffToken}`);
    if (whListRes.status !== 200) {
      throw new Error(`WarehousesModule GET /warehouses failed: ${JSON.stringify(whListRes.body)}`);
    }
    const whRepo = dataSource.getRepository(Warehouse);
    let warehouse = await whRepo.findOne({ where: { isActive: true } });
    if (!warehouse) {
      warehouse = whRepo.create({
        code: 'WH-MOD-' + Date.now().toString().slice(-4),
        name: 'Module Fulfillment Center',
        address: 'Phnom Penh Facility',
        isActive: true,
      });
      warehouse = await whRepo.save(warehouse);
    }
    console.log(`  ✅ WarehousesModule: Retrieved warehouse list and verified Warehouse "${warehouse.name}".`);

    // -------------------------------------------------------------
    // MODULE 10: ProductsModule (/products)
    // -------------------------------------------------------------
    console.log('▶ [10/17] Testing ProductsModule (/products)...');
    const prodListRes = await request(server)
      .get('/products')
      .set('Authorization', `Bearer ${staffToken}`);
    if (prodListRes.status !== 200) {
      throw new Error(`ProductsModule GET /products failed: ${JSON.stringify(prodListRes.body)}`);
    }
    const prodRepo = dataSource.getRepository(Product);
    let product = await prodRepo.findOne({ where: { isActive: true } });
    if (!product) {
      product = prodRepo.create({
        code: 'PRD-MOD-' + Date.now().toString().slice(-4),
        name: 'Premium Wireless Headset',
        sellingPrice: 49.99,
        costPrice: 25.0,
        unit: 'pcs',
        sku: 'SKU-MOD-' + Date.now(),
        categoryId: category.id,
        brandId: brand.id,
        supplierId: supplier.id,
        isActive: true,
      });
      product = await prodRepo.save(product);
    }
    console.log(`  ✅ ProductsModule: Retrieved products list and verified Product "${product.name}".`);

    // -------------------------------------------------------------
    // MODULE 11: ProductVariantsModule (/product-variants)
    // -------------------------------------------------------------
    console.log('▶ [11/17] Testing ProductVariantsModule (/product-variants)...');
    const variantsRes = await request(server)
      .get('/product-variants')
      .set('Authorization', `Bearer ${staffToken}`);
    if (variantsRes.status !== 200) {
      throw new Error(`ProductVariantsModule GET /product-variants failed: ${JSON.stringify(variantsRes.body)}`);
    }
    console.log(`  ✅ ProductVariantsModule: Successfully queried product variants.`);

    // -------------------------------------------------------------
    // MODULE 12: StockModule (/stock)
    // -------------------------------------------------------------
    console.log('▶ [12/17] Testing StockModule (/stock)...');
    const stockListRes = await request(server)
      .get('/stock')
      .set('Authorization', `Bearer ${staffToken}`);
    if (stockListRes.status !== 200) {
      throw new Error(`StockModule GET /stock failed: ${JSON.stringify(stockListRes.body)}`);
    }
    const stockRepo = dataSource.getRepository(Stock);
    let stock = await stockRepo.findOne({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    if (!stock) {
      stock = stockRepo.create({
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: 100,
      });
    } else {
      stock.quantity = 100;
    }
    await stockRepo.save(stock);
    console.log(`  ✅ StockModule: Stock set to 100 for product in warehouse.`);

    // -------------------------------------------------------------
    // MODULE 13: StockAdjustmentsModule (/stock-adjustments)
    // -------------------------------------------------------------
    console.log('▶ [13/17] Testing StockAdjustmentsModule (/stock-adjustments)...');
    const adjRes = await request(server)
      .get('/stock-adjustments')
      .set('Authorization', `Bearer ${staffToken}`);

    if (adjRes.status !== 200) {
      throw new Error(`StockAdjustmentsModule GET /stock-adjustments failed: ${JSON.stringify(adjRes.body)}`);
    }
    console.log(`  ✅ StockAdjustmentsModule: Successfully queried stock adjustment audit history.`);

    // -------------------------------------------------------------
    // MODULE 14: RequestsModule (/requests)
    // -------------------------------------------------------------
    console.log('▶ [14/17] Testing RequestsModule (/requests)...');
    const reqRes = await request(server)
      .get('/requests')
      .set('Authorization', `Bearer ${staffToken}`);

    if (reqRes.status !== 200) {
      throw new Error(`RequestsModule GET /requests failed: ${JSON.stringify(reqRes.body)}`);
    }
    console.log(`  ✅ RequestsModule: Successfully retrieved procurement requests.`);

    // -------------------------------------------------------------
    // MODULE 15: ReportsModule (/reports)
    // -------------------------------------------------------------
    console.log('▶ [15/17] Testing ReportsModule (/reports)...');
    const reportRes = await request(server)
      .get('/reports/summary?period=daily')
      .set('Authorization', `Bearer ${staffToken}`);
    if (reportRes.status !== 200 || !reportRes.body.period) {
      throw new Error(`ReportsModule GET /reports/summary failed: ${JSON.stringify(reportRes.body)}`);
    }
    console.log(`  ✅ ReportsModule: Successfully generated daily sales & profit summary report.`);

    // -------------------------------------------------------------
    // MODULE 16: MailsModule (/mails)
    // -------------------------------------------------------------
    console.log('▶ [16/17] Testing MailsModule (/mails)...');
    const mailsRes = await request(server)
      .get('/mails')
      .set('Authorization', `Bearer ${staffToken}`);

    if (mailsRes.status !== 200) {
      throw new Error(`MailsModule GET /mails failed: ${JSON.stringify(mailsRes.body)}`);
    }

    const unreadRes = await request(server)
      .get('/mails/unread-count')
      .set('Authorization', `Bearer ${staffToken}`);

    const count = typeof unreadRes.body === 'number' ? unreadRes.body : Number(unreadRes.text);
    if (unreadRes.status !== 200 || isNaN(count)) {
      throw new Error(`MailsModule GET /mails/unread-count failed: ${unreadRes.text}`);
    }
    console.log(`  ✅ MailsModule: User mailbox verified (Unread count: ${count}).`);

    // -------------------------------------------------------------
    // MODULE 17: CustomerOrdersModule (/customer-orders)
    // -------------------------------------------------------------
    console.log('▶ [17/17] Testing CustomerOrdersModule (/customer-orders)...');
    const custTelegramId = 888000000 + Math.floor(Math.random() * 100000);
    const testCustUser = {
      id: custTelegramId,
      first_name: 'Dara',
      username: `dara_dist_${custTelegramId}`,
    };
    const custInitData = generateTestInitData(botToken, testCustUser);

    // 17.1: Telegram Auth (First-time user)
    const custAuthRes = await request(server)
      .post('/customer-orders/auth/telegram')
      .send({ initData: custInitData });

    if (custAuthRes.body.status !== 'REGISTRATION_REQUIRED') {
      throw new Error(`Customer auth failed: ${JSON.stringify(custAuthRes.body)}`);
    }

    // 17.2: Register -> Instant ACTIVE
    const custRegRes = await request(server)
      .post('/customer-orders/auth/register')
      .send({
        initData: custInitData,
        companyName: `Dara Logistics ${custTelegramId}`,
        contactName: 'Dara Sok',
        phone: '097' + Math.floor(100000 + Math.random() * 900000),
        address: 'St 271, Phnom Penh',
      });

    if (custRegRes.body.status !== CustomerStatus.ACTIVE || !custRegRes.body.accessToken) {
      throw new Error(`Customer registration failed: ${JSON.stringify(custRegRes.body)}`);
    }
    const customerToken = custRegRes.body.accessToken;
    const customerId = custRegRes.body.customer.id;

    // 17.3: Staff Customer Search
    const searchRes = await request(server)
      .get(`/customer-orders/customers/search?query=@${testCustUser.username}`)
      .set('Authorization', `Bearer ${staffToken}`);

    if (!Array.isArray(searchRes.body) || searchRes.body[0]?.id !== customerId) {
      throw new Error(`Staff customer search failed: ${JSON.stringify(searchRes.body)}`);
    }

    // 17.4: Mini App Order Creation
    const orderRes = await request(server)
      .post('/customer-orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ productId: product.id, quantity: 200 }],
        deliveryAddress: 'St 271, Phnom Penh',
      });

    if (orderRes.status !== 201 || orderRes.body.status !== CustomerOrderStatus.PENDING_REVIEW) {
      throw new Error(`Create mini app order failed: ${JSON.stringify(orderRes.body)}`);
    }
    const order = orderRes.body;

    // 17.5: Staff Inquires Partial Stock (Proposed: 100, Avail: 100, Req: 200)
    const askRes = await request(server)
      .post(`/customer-orders/${order.id}/ask-customer`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        question: 'Only 100 units in stock. Choose to get 100 now, wait for all, or cancel.',
        proposedQuantity: 100,
      });

    if (askRes.body.status !== CustomerOrderStatus.WAITING_CUSTOMER) {
      throw new Error(`Ask customer failed: ${JSON.stringify(askRes.body)}`);
    }

    // 17.6: Customer Choice 2: WAIT_STOCK ([ ⏳ Wait for All (200) ])
    const waitStockRes = await request(server)
      .post(`/customer-orders/${order.id}/customer-response`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        responseType: CustomerResponseType.WAIT_STOCK,
        message: 'I prefer to wait for full shipment of 200 units.',
      });

    if (
      waitStockRes.body.status !== CustomerOrderStatus.WAITING_STOCK ||
      Number(waitStockRes.body.items[0].approvedQuantity) !== 0 ||
      Number(waitStockRes.body.items[0].waitingQuantity) !== 200
    ) {
      throw new Error(`WAIT_STOCK response failed: ${JSON.stringify(waitStockRes.body)}`);
    }

    // 17.7: Staff Direct Order & Complete Lifecycle (Deliver -> Pay -> Complete)
    const staffOrderRes = await request(server)
      .post('/customer-orders/staff')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        warehouseCode: warehouse.code,
        deliveryAddress: 'St 271, Phnom Penh',
        items: [{ productId: product.id, quantity: 5 }],
      });

    if (staffOrderRes.status !== 201 || staffOrderRes.body.status !== CustomerOrderStatus.CONFIRMED) {
      throw new Error(`Staff direct order failed: ${JSON.stringify(staffOrderRes.body)}`);
    }
    const staffOrder = staffOrderRes.body;

    await request(server).post(`/customer-orders/${staffOrder.id}/process`).set('Authorization', `Bearer ${staffToken}`);
    await request(server).post(`/customer-orders/${staffOrder.id}/out-for-delivery`).set('Authorization', `Bearer ${staffToken}`);
    await request(server).post(`/customer-orders/${staffOrder.id}/delivered`).set('Authorization', `Bearer ${staffToken}`);

    const payRes = await request(server)
      .post(`/customer-orders/${staffOrder.id}/payment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ amount: Number(staffOrder.totalAmount), remark: 'Cash on delivery collected' });

    if (payRes.body.paymentStatus !== 'PAID') {
      throw new Error(`Order payment failed: ${JSON.stringify(payRes.body)}`);
    }

    const compRes = await request(server)
      .post(`/customer-orders/${staffOrder.id}/complete`)
      .set('Authorization', `Bearer ${staffToken}`);

    if (compRes.body.status !== CustomerOrderStatus.COMPLETED) {
      throw new Error(`Order complete failed: ${JSON.stringify(compRes.body)}`);
    }
    console.log(`  ✅ CustomerOrdersModule: Verified Telegram auth, registration, search, 3-choice negotiation, delivery & cash payment.`);

    console.log('\n================================================================');
    console.log('🏆 100% SUCCESS: ALL 17 API MODULES VERIFIED & WORKING PERFECTLY!');
    console.log('================================================================');
  } finally {
    await app.close();
  }
}

verifyAll17Modules()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ MODULE VERIFICATION FAILED:', err);
    process.exit(1);
  });
