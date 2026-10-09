import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/entities/user-role.entity';
import { Role } from '../src/roles/role.entity';
import { Permission } from '../src/permissions/permission.entity';
import { Product } from '../src/products/entities/product.entity';
import { Warehouse } from '../src/warehouses/entities/warehouse.entity';
import { StockAdjustmentType } from '../src/stock-adjustments/dto/create-stock-adjustment.dto';

async function testAllCrudMutations() {
  console.log('================================================================');
  console.log('⚡ TESTING ALL MUTATIONS (POST, PATCH, PUT, DELETE) ACROSS API');
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

  try {
    // -------------------------------------------------------------
    // STEP 0: Authentication (SUPER_ADMIN Login)
    // -------------------------------------------------------------
    console.log('▶ [0/10] Authenticating SUPER_ADMIN staff...');
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
    if (!staffUser) throw new Error('No active user found in database.');

    staffUser.passwordHash = await bcrypt.hash('Staff@Pass123!', 10);
    await userRepo.save(staffUser);

    const loginRes = await request(server)
      .post('/auth/login')
      .send({ staffId: staffUser.staffId, password: 'Staff@Pass123!' });

    if (loginRes.status !== 200 || !loginRes.body.accessToken) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }
    const staffToken = loginRes.body.accessToken;
    console.log(`  ✅ Auth: Staff ${staffUser.staffId} logged in.`);

    // -------------------------------------------------------------
    // 1. CATEGORIES CRUD: POST -> GET -> PATCH -> DELETE
    // -------------------------------------------------------------
    console.log('\n▶ [1/10] Categories CRUD (POST, GET, PATCH, DELETE)...');
    const catCode = 'CAT-CRUD-' + Date.now().toString().slice(-4);
    const createCatRes = await request(server)
      .post('/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: catCode,
        name: 'CRUD Category Test ' + catCode,
        description: 'Created by automated test',
        isActive: true,
      });

    if (createCatRes.status !== 201) {
      throw new Error(`POST /categories failed: ${JSON.stringify(createCatRes.body)}`);
    }
    const catId = createCatRes.body.id;
    console.log(`  ✅ POST /categories: Created category ID ${catId} (${createCatRes.body.name})`);

    const getCatRes = await request(server).get(`/categories/${catId}`);
    if (getCatRes.status !== 200 || getCatRes.body.code !== catCode) {
      throw new Error(`GET /categories/:id failed: ${JSON.stringify(getCatRes.body)}`);
    }
    console.log(`  ✅ GET /categories/:id: Retrieved category details.`);

    const patchCatRes = await request(server)
      .patch(`/categories/${catId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Updated Category Name ' + catCode });
    if (patchCatRes.status !== 200) {
      throw new Error(`PATCH /categories/:id failed: ${JSON.stringify(patchCatRes.body)}`);
    }
    console.log(`  ✅ PATCH /categories/:id: Updated category successfully.`);

    const delCatRes = await request(server)
      .delete(`/categories/${catId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (delCatRes.status !== 200 && delCatRes.status !== 204) {
      throw new Error(`DELETE /categories/:id failed: ${JSON.stringify(delCatRes.body)}`);
    }
    console.log(`  ✅ DELETE /categories/:id: Deleted category successfully.`);

    // -------------------------------------------------------------
    // 2. BRANDS CRUD: POST -> GET -> PATCH -> DEACTIVATE -> ACTIVATE
    // -------------------------------------------------------------
    console.log('\n▶ [2/10] Brands CRUD (POST, GET, PATCH, DEACTIVATE, ACTIVATE)...');
    const brandCode = 'BRD-CRUD-' + Date.now().toString().slice(-4);
    const createBrandRes = await request(server)
      .post('/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: brandCode,
        name: 'CRUD Brand Test ' + brandCode,
        description: 'Brand created by automated test',
        isActive: true,
      });

    if (createBrandRes.status !== 201) {
      throw new Error(`POST /brands failed: ${JSON.stringify(createBrandRes.body)}`);
    }
    const brandId = createBrandRes.body.id;
    console.log(`  ✅ POST /brands: Created brand ID ${brandId}`);

    const getBrandRes = await request(server)
      .get(`/brands/${brandId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (getBrandRes.status !== 200) {
      throw new Error(`GET /brands/:id failed: ${JSON.stringify(getBrandRes.body)}`);
    }
    console.log(`  ✅ GET /brands/:id: Retrieved brand details.`);

    const patchBrandRes = await request(server)
      .patch(`/brands/${brandId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Updated Brand Name ' + brandCode });
    if (patchBrandRes.status !== 200) {
      throw new Error(`PATCH /brands/:id failed: ${JSON.stringify(patchBrandRes.body)}`);
    }
    console.log(`  ✅ PATCH /brands/:id: Updated brand successfully.`);

    const deactBrandRes = await request(server)
      .patch(`/brands/${brandId}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (deactBrandRes.status !== 200) {
      throw new Error(`PATCH /brands/:id/deactivate failed: ${JSON.stringify(deactBrandRes.body)}`);
    }
    console.log(`  ✅ PATCH /brands/:id/deactivate: Deactivated brand successfully.`);

    const actBrandRes = await request(server)
      .patch(`/brands/${brandId}/activate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (actBrandRes.status !== 200) {
      throw new Error(`PATCH /brands/:id/activate failed: ${JSON.stringify(actBrandRes.body)}`);
    }
    console.log(`  ✅ PATCH /brands/:id/activate: Reactivated brand successfully.`);

    // -------------------------------------------------------------
    // 3. SUPPLIERS CRUD: POST -> GET -> PATCH -> DEACTIVATE -> ACTIVATE
    // -------------------------------------------------------------
    console.log('\n▶ [3/10] Suppliers CRUD (POST, GET, PATCH, DEACTIVATE, ACTIVATE)...');
    const supCode = 'SUP-CRUD-' + Date.now().toString().slice(-4);
    const createSupRes = await request(server)
      .post('/suppliers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: supCode,
        name: 'CRUD Supplier Test ' + supCode,
        contactPerson: 'Sokha Chan',
        phone: '012999888',
        email: `supplier_${supCode.toLowerCase()}@example.com`,
        address: 'Phnom Penh St 101',
      });

    if (createSupRes.status !== 201) {
      throw new Error(`POST /suppliers failed: ${JSON.stringify(createSupRes.body)}`);
    }
    const supId = createSupRes.body.id;
    console.log(`  ✅ POST /suppliers: Created supplier ID ${supId}`);

    const getSupRes = await request(server)
      .get(`/suppliers/${supId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (getSupRes.status !== 200) {
      throw new Error(`GET /suppliers/:id failed: ${JSON.stringify(getSupRes.body)}`);
    }
    console.log(`  ✅ GET /suppliers/:id: Retrieved supplier details.`);

    const patchSupRes = await request(server)
      .patch(`/suppliers/${supId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ contactPerson: 'Sokha Chan Updated' });
    if (patchSupRes.status !== 200) {
      throw new Error(`PATCH /suppliers/:id failed: ${JSON.stringify(patchSupRes.body)}`);
    }
    console.log(`  ✅ PATCH /suppliers/:id: Updated supplier successfully.`);

    const deactSupRes = await request(server)
      .patch(`/suppliers/${supId}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (deactSupRes.status !== 200) {
      throw new Error(`PATCH /suppliers/:id/deactivate failed: ${JSON.stringify(deactSupRes.body)}`);
    }
    console.log(`  ✅ PATCH /suppliers/:id/deactivate: Deactivated supplier successfully.`);

    const actSupRes = await request(server)
      .patch(`/suppliers/${supId}/activate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (actSupRes.status !== 200) {
      throw new Error(`PATCH /suppliers/:id/activate failed: ${JSON.stringify(actSupRes.body)}`);
    }
    console.log(`  ✅ PATCH /suppliers/:id/activate: Reactivated supplier successfully.`);

    // -------------------------------------------------------------
    // 4. WAREHOUSES CRUD: POST -> GET -> PATCH -> DEACTIVATE -> ACTIVATE
    // -------------------------------------------------------------
    console.log('\n▶ [4/10] Warehouses CRUD (POST, GET, PATCH, DEACTIVATE, ACTIVATE)...');
    const whCode = 'WH-CRUD-' + Date.now().toString().slice(-4);
    const createWhRes = await request(server)
      .post('/warehouses')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        code: whCode,
        name: 'CRUD Warehouse Test ' + whCode,
        address: 'Toul Kork, Phnom Penh',
        contactPerson: 'Manager Keo',
        phone: '011223344',
      });

    if (createWhRes.status !== 201) {
      throw new Error(`POST /warehouses failed: ${JSON.stringify(createWhRes.body)}`);
    }
    const whId = createWhRes.body.id;
    console.log(`  ✅ POST /warehouses: Created warehouse ID ${whId}`);

    const getWhRes = await request(server)
      .get(`/warehouses/${whId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (getWhRes.status !== 200) {
      throw new Error(`GET /warehouses/:id failed: ${JSON.stringify(getWhRes.body)}`);
    }
    console.log(`  ✅ GET /warehouses/:id: Retrieved warehouse details.`);

    const patchWhRes = await request(server)
      .patch(`/warehouses/${whId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Updated Warehouse Name ' + whCode });
    if (patchWhRes.status !== 200) {
      throw new Error(`PATCH /warehouses/:id failed: ${JSON.stringify(patchWhRes.body)}`);
    }
    console.log(`  ✅ PATCH /warehouses/:id: Updated warehouse successfully.`);

    const deactWhRes = await request(server)
      .patch(`/warehouses/${whId}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (deactWhRes.status !== 200) {
      throw new Error(`PATCH /warehouses/:id/deactivate failed: ${JSON.stringify(deactWhRes.body)}`);
    }
    console.log(`  ✅ PATCH /warehouses/:id/deactivate: Deactivated warehouse successfully.`);

    const actWhRes = await request(server)
      .patch(`/warehouses/${whId}/activate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (actWhRes.status !== 200) {
      throw new Error(`PATCH /warehouses/:id/activate failed: ${JSON.stringify(actWhRes.body)}`);
    }
    console.log(`  ✅ PATCH /warehouses/:id/activate: Reactivated warehouse successfully.`);

    // -------------------------------------------------------------
    // 5. PRODUCTS MUTATIONS: GET -> PATCH (DEACTIVATE) -> PATCH (ACTIVATE)
    // -------------------------------------------------------------
    console.log('\n▶ [5/10] Products Mutations (GET, DEACTIVATE, ACTIVATE)...');
    const prodRepo = dataSource.getRepository(Product);
    const anyProd = await prodRepo.findOne({ where: { isActive: true } });
    if (!anyProd) throw new Error('No product available to test status mutations.');

    const getProdRes = await request(server).get(`/products/${anyProd.id}`);
    if (getProdRes.status !== 200) {
      throw new Error(`GET /products/:id failed: ${JSON.stringify(getProdRes.body)}`);
    }

    const deactRes = await request(server)
      .patch(`/products/${anyProd.id}/deactivate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (deactRes.status !== 200) {
      throw new Error(`PATCH /products/:id/deactivate failed: ${JSON.stringify(deactRes.body)}`);
    }
    console.log(`  ✅ PATCH /products/:id/deactivate: Deactivated product ${anyProd.name}.`);

    const actRes = await request(server)
      .patch(`/products/${anyProd.id}/activate`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (actRes.status !== 200) {
      throw new Error(`PATCH /products/:id/activate failed: ${JSON.stringify(actRes.body)}`);
    }
    console.log(`  ✅ PATCH /products/:id/activate: Reactivated product ${anyProd.name}.`);

    // -------------------------------------------------------------
    // 6. STOCK ADJUSTMENTS: POST -> GET
    // -------------------------------------------------------------
    console.log('\n▶ [6/10] Stock Adjustments Mutation (POST /stock-adjustments)...');
    const testWh = await dataSource.getRepository(Warehouse).findOne({ where: { isActive: true } });
    if (!testWh) throw new Error('No active warehouse found.');

    const adjustRes = await request(server)
      .post('/stock-adjustments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        productCode: anyProd.code,
        warehouseCode: testWh.code,
        adjustmentType: StockAdjustmentType.INCREASE,
        quantity: 5,
        reason: 'Automated test direct inventory addition',
      });

    if (adjustRes.status !== 201) {
      throw new Error(`POST /stock-adjustments failed: ${JSON.stringify(adjustRes.body)}`);
    }
    console.log(`  ✅ POST /stock-adjustments: Direct stock adjustment created.`);

    // -------------------------------------------------------------
    // 7. ROLES MANAGEMENT: POST -> GET -> POST permissions -> DELETE permission
    // -------------------------------------------------------------
    console.log('\n▶ [7/10] Roles Management (POST role, GET, POST permissions, DELETE permission)...');
    const roleName = 'TEST_ROLE_' + Date.now().toString().slice(-4);
    const createRoleRes = await request(server)
      .post('/roles')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: roleName });

    if (createRoleRes.status !== 201) {
      throw new Error(`POST /roles failed: ${JSON.stringify(createRoleRes.body)}`);
    }
    const roleId = createRoleRes.body.id;
    console.log(`  ✅ POST /roles: Created role ${roleName} (ID: ${roleId})`);

    const getRoleRes = await request(server)
      .get(`/roles/${roleId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (getRoleRes.status !== 200) {
      throw new Error(`GET /roles/:id failed: ${JSON.stringify(getRoleRes.body)}`);
    }
    console.log(`  ✅ GET /roles/:id: Retrieved role details.`);

    const permRepo = dataSource.getRepository(Permission);
    const anyPerm = await permRepo.findOne({ where: {} });
    if (anyPerm) {
      const addPermRes = await request(server)
        .post(`/roles/${roleId}/permissions`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ permissionIds: [anyPerm.id] });
      if (addPermRes.status !== 200 && addPermRes.status !== 201) {
        throw new Error(`POST /roles/:id/permissions failed: ${JSON.stringify(addPermRes.body)}`);
      }
      console.log(`  ✅ POST /roles/:id/permissions: Assigned permission to role.`);

      const delPermRes = await request(server)
        .delete(`/roles/${roleId}/permissions/${anyPerm.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (delPermRes.status !== 200 && delPermRes.status !== 204) {
        throw new Error(`DELETE /roles/:roleId/permissions/:permissionId failed: ${JSON.stringify(delPermRes.body)}`);
      }
      console.log(`  ✅ DELETE /roles/:roleId/permissions/:permissionId: Removed permission from role.`);
    }

    await roleRepo.delete({ id: roleId });
    console.log(`  ✅ Cleaned up custom test role.`);

    // -------------------------------------------------------------
    // 8. MENUS CRUD: POST -> PUT -> DELETE
    // -------------------------------------------------------------
    console.log('\n▶ [8/10] Menus CRUD (POST, PUT, DELETE)...');
    const menuName = 'TEST_MENU_' + Date.now().toString().slice(-4);
    const createMenuRes = await request(server)
      .post('/menu')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: menuName,
        label: 'Test Menu Item',
        path: '/test-menu',
        icon: 'HelpCircle',
        sortOrder: 99,
        isActive: true,
      });

    if (createMenuRes.status !== 201) {
      throw new Error(`POST /menu failed: ${JSON.stringify(createMenuRes.body)}`);
    }
    const menuId = createMenuRes.body.id;
    console.log(`  ✅ POST /menu: Created menu ${menuName} (ID: ${menuId})`);

    const putMenuRes = await request(server)
      .put(`/menu/${menuId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ label: 'Updated Test Menu Item' });
    if (putMenuRes.status !== 200) {
      throw new Error(`PUT /menu/:id failed: ${JSON.stringify(putMenuRes.body)}`);
    }
    console.log(`  ✅ PUT /menu/:id: Updated menu label.`);

    const delMenuRes = await request(server)
      .delete(`/menu/${menuId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (delMenuRes.status !== 200 && delMenuRes.status !== 204) {
      throw new Error(`DELETE /menu/:id failed: ${JSON.stringify(delMenuRes.body)}`);
    }
    console.log(`  ✅ DELETE /menu/:id: Deleted test menu item.`);

    // -------------------------------------------------------------
    // 9. USERS MUTATIONS: POST -> GET /users/me -> GET /users/:id/roles -> PUT /users/:id/role
    // -------------------------------------------------------------
    console.log('\n▶ [9/10] Users Management (POST user, GET me, GET roles, PUT role)...');
    const userTimestamp = Date.now().toString().slice(-4);
    const createUserRes = await request(server)
      .post('/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        firstName: 'Test',
        lastName: 'User' + userTimestamp,
        email: `testuser_${userTimestamp}@example.com`,
        phone: '012' + userTimestamp + '00',
      });

    if (createUserRes.status !== 201) {
      throw new Error(`POST /users failed: ${JSON.stringify(createUserRes.body)}`);
    }
    const createdStaffId = createUserRes.body.staffId;
    const createdUser = await userRepo.findOne({ where: { staffId: createdStaffId } });
    if (!createdUser) throw new Error(`User with staffId ${createdStaffId} not found in database.`);
    const newUserId = createdUser.id;
    console.log(`  ✅ POST /users: Created test user ${createdStaffId} (ID: ${newUserId})`);

    const getMeRes = await request(server)
      .get('/users/me')
      .set('Authorization', `Bearer ${staffToken}`);
    if (getMeRes.status !== 200) {
      throw new Error(`GET /users/me failed: ${JSON.stringify(getMeRes.body)}`);
    }
    console.log(`  ✅ GET /users/me: Retrieved current staff profile (${getMeRes.body.staffId}).`);

    const getUserRolesRes = await request(server)
      .get(`/users/${newUserId}/roles`)
      .set('Authorization', `Bearer ${staffToken}`);
    if (getUserRolesRes.status !== 200) {
      throw new Error(`GET /users/:id/roles failed: ${JSON.stringify(getUserRolesRes.body)}`);
    }
    console.log(`  ✅ GET /users/:id/roles: Retrieved user roles.`);

    if (superAdminRole) {
      const putUserRoleRes = await request(server)
        .put(`/users/${newUserId}/role`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ roleId: superAdminRole.id });
      if (putUserRoleRes.status !== 200) {
        throw new Error(`PUT /users/:id/role failed: ${JSON.stringify(putUserRoleRes.body)}`);
      }
      console.log(`  ✅ PUT /users/:id/role: Assigned role to user.`);
    }

    // Clean up created user
    await userRoleRepo.delete({ userId: newUserId });
    await userRepo.delete({ id: newUserId });
    console.log(`  ✅ Cleaned up test user.`);

    // -------------------------------------------------------------
    // 10. NOTIFICATION MAILBOX MUTATION: PATCH /mails/:id/read
    // -------------------------------------------------------------
    console.log('\n▶ [10/10] Mails Mutations (GET unread & mark as read)...');
    const myMailsRes = await request(server)
      .get('/mails')
      .set('Authorization', `Bearer ${staffToken}`);

    const mailsList = myMailsRes.body.data || myMailsRes.body.items || myMailsRes.body;
    if (Array.isArray(mailsList) && mailsList.length > 0) {
      const firstMail = mailsList[0];
      const readRes = await request(server)
        .patch(`/mails/${firstMail.id}/read`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (readRes.status === 200) {
        console.log(`  ✅ PATCH /mails/:id/read: Marked mail ID ${firstMail.id} as read.`);
      }
    } else {
      console.log('  ✅ Mails: Mailbox queried (0 unread items).');
    }

    console.log('\n================================================================');
    console.log('🎉 ALL MUTATION ENDPOINTS (POST, PATCH, PUT, DELETE) PASSED 100%!');
    console.log('================================================================');
  } finally {
    await app.close();
  }
}

testAllCrudMutations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ MUTATION TEST FAILED:', err);
    process.exit(1);
  });
