import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { UserProfile } from '../../users/entities/user-profile.entity';
import { UserRole } from '../../users/entities/user-role.entity';

import { Role } from '../../roles/role.entity';
import { RolePermission } from '../../roles/role-permission.entity';
import { RoleMenu } from '../../roles/role-menu.entity';

import { Permission } from '../../permissions/permission.entity';

import { Menu } from '../../menu/menu.entity';

export async function seedSystem(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    console.log('Starting system seed...');

    // =====================================================
    // 1. PERMISSIONS
    // =====================================================

    // Builds { name: 'PRODUCT_VIEW', resource: 'product', action: 'view' }
    const define = (resource: string, actions: string[]) =>
      actions.map((action) => ({
        name: `${resource}_${action}`.toUpperCase(),
        resource,
        action,
      }));

    const permissionDefinitions = [
      // Users (team members). USER_ROLE_UPDATE = change another user's role
      ...define('user', ['view', 'create', 'role_update']),

      // Access control
      ...define('role', ['view', 'create', 'update', 'delete']),
      ...define('permission', ['view', 'create', 'update', 'delete']),
      ...define('menu', ['view', 'create', 'update', 'delete']),

      // Catalog (products + variants)
      ...define('product', ['view', 'create', 'update', 'delete', 'import', 'image']),

      // Master data: VIEW to read, MANAGE to create / edit / (de)activate
      ...define('category', ['view', 'manage']),
      ...define('brand', ['view', 'manage']),
      ...define('supplier', ['view', 'manage']),
      ...define('warehouse', ['view', 'manage']),

      // Stock. STOCK_ADJUST = change stock directly (no approval).
      // ADJUSTMENT_VIEW = read the adjustment audit log.
      ...define('stock', ['view', 'adjust']),
      ...define('adjustment', ['view']),

      // Approval workflow
      ...define('request', ['view', 'create', 'certify', 'approve']),

      // Purchase orders: Manager creates, Admin approves, Staff receives goods
      ...define('po', ['view', 'create', 'approve', 'receive']),

      // Reports
      ...define('report', ['view', 'send']),
    ];

    // =====================================================
    // 2. CREATE / FIND PERMISSIONS
    // =====================================================

    const permissions = new Map<string, Permission>();

    for (const definition of permissionDefinitions) {
      let permission = await manager.findOne(Permission, {
        where: {
          name: definition.name,
        },
      });

      if (!permission) {
        permission = manager.create(Permission, {
          ...definition,
          isSystem: true,
        });

        permission = await manager.save(Permission, permission);

        console.log(`Created permission: ${permission.name}`);
      }

      permissions.set(permission.name, permission);
    }

    // =====================================================
    // 3. ROLES
    // =====================================================

    const roleDefinitions = [
      {
        name: 'SUPER_ADMIN',
      },
      {
        name: 'ADMIN',
      },
      {
        name: 'MANAGER',
      },
      {
        name: 'STAFF',
      },
    ];

    const roles = new Map<string, Role>();

    for (const definition of roleDefinitions) {
      let role = await manager.findOne(Role, {
        where: {
          name: definition.name,
        },
      });

      if (!role) {
        role = manager.create(Role, {
          name: definition.name,
          isSystem: true,
        });

        role = await manager.save(Role, role);

        console.log(`Created role: ${role.name}`);
      }

      roles.set(role.name, role);
    }

    // =====================================================
    // 4. ROLE â†’ PERMISSIONS
    // =====================================================

    const allPermissionNames = permissionDefinitions.map(
      (permission) => permission.name,
    );

    // Read-only access to catalog / master data / stock.
    const READ_ONLY = [
      'PRODUCT_VIEW',
      'CATEGORY_VIEW',
      'BRAND_VIEW',
      'SUPPLIER_VIEW',
      'WAREHOUSE_VIEW',
      'STOCK_VIEW',
    ];

    const rolePermissionMap: Record<string, string[]> = {
      // SUPER_ADMIN: everything (also bypassed in the guards)
      SUPER_ADMIN: allPermissionNames,

      // ADMIN: runs day-to-day operations and manages users.
      // Does NOT edit roles / permissions / menus (system configuration).
      ADMIN: [
        'USER_VIEW',
        'USER_CREATE',
        'USER_ROLE_UPDATE',
        'ROLE_VIEW',

        'PRODUCT_VIEW',
        'PRODUCT_CREATE',
        'PRODUCT_UPDATE',
        'PRODUCT_DELETE',
        'PRODUCT_IMPORT',
        'PRODUCT_IMAGE',

        'CATEGORY_VIEW',
        'CATEGORY_MANAGE',
        'BRAND_VIEW',
        'BRAND_MANAGE',
        'SUPPLIER_VIEW',
        'SUPPLIER_MANAGE',
        'WAREHOUSE_VIEW',
        'WAREHOUSE_MANAGE',

        'STOCK_VIEW',
        'STOCK_ADJUST',
        'ADJUSTMENT_VIEW',

        'REQUEST_VIEW',
        'REQUEST_CREATE',
        'REQUEST_CERTIFY',
        'REQUEST_APPROVE',

        'PO_VIEW',
        'PO_APPROVE',

        'REPORT_VIEW',
        'REPORT_SEND',
      ],

      // MANAGER: supervises staff, reads everything, certifies AND approves requests.
      // Changes to data go through requests (no direct create / adjust).
      MANAGER: [
        'USER_VIEW',
        'USER_CREATE',
        'USER_ROLE_UPDATE',

        ...READ_ONLY,
        'ADJUSTMENT_VIEW',

        'REQUEST_VIEW',
        'REQUEST_CREATE',
        'REQUEST_CERTIFY',
        'REQUEST_APPROVE',

        'PRODUCT_IMPORT',
        'PRODUCT_IMAGE',

        'PO_VIEW',
        'PO_CREATE',

        'REPORT_VIEW',
      ],

      // STAFF: reads data and submits requests (create product, adjust stock...).
      STAFF: [
        ...READ_ONLY,
        'REQUEST_VIEW',
        'REQUEST_CREATE',
        'PO_VIEW',
        'PO_RECEIVE',
      ],
    };

    for (const [roleName, permissionNames] of Object.entries(
      rolePermissionMap,
    )) {
      const role = roles.get(roleName);

      if (!role) {
        throw new Error(`Role ${roleName} not found`);
      }

      for (const permissionName of permissionNames) {
        const permission = permissions.get(permissionName);

        if (!permission) {
          throw new Error(`Permission ${permissionName} not found`);
        }

        const existing = await manager.findOne(RolePermission, {
          where: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });

        if (!existing) {
          const rolePermission = manager.create(RolePermission, {
            roleId: role.id,
            permissionId: permission.id,
          });

          await manager.save(RolePermission, rolePermission);
        }
      }
    }

    // =====================================================
    // 5. MENUS
    // =====================================================

    const menuDefinitions = [
      { name: 'DASHBOARD', label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', parentName: null, sortOrder: 1 },

      { name: 'INVENTORY', label: 'Inventory', path: null, icon: 'Warehouse', parentName: null, sortOrder: 2 },
      { name: 'PRODUCTS', label: 'Products', path: '/products', icon: 'Package', parentName: 'INVENTORY', sortOrder: 1 },
      { name: 'STOCK', label: 'Stock', path: '/stock', icon: 'Boxes', parentName: 'INVENTORY', sortOrder: 2 },
      { name: 'WAREHOUSES', label: 'Warehouses', path: '/warehouses', icon: 'Building2', parentName: 'INVENTORY', sortOrder: 3 },
      { name: 'CATEGORIES', label: 'Categories', path: '/categories', icon: 'Tags', parentName: 'INVENTORY', sortOrder: 4 },
      { name: 'BRANDS', label: 'Brands', path: '/brands', icon: 'BadgeCheck', parentName: 'INVENTORY', sortOrder: 5 },
      { name: 'SUPPLIERS', label: 'Suppliers', path: '/suppliers', icon: 'Truck', parentName: 'INVENTORY', sortOrder: 6 },
      { name: 'ADJUSTMENTS', label: 'Stock Adjustments', path: '/stock-adjustments', icon: 'ClipboardList', parentName: 'INVENTORY', sortOrder: 7 },

      { name: 'STAFF', label: 'Staff', path: '/staff', icon: 'Users', parentName: null, sortOrder: 3 },

      { name: 'ACCESS_CONTROL', label: 'Access Control', path: null, icon: 'Shield', parentName: null, sortOrder: 4 },
      { name: 'ROLES', label: 'Roles', path: '/roles', icon: 'ShieldCheck', parentName: 'ACCESS_CONTROL', sortOrder: 1 },
      { name: 'PERMISSIONS', label: 'Permissions', path: '/permissions', icon: 'KeyRound', parentName: 'ACCESS_CONTROL', sortOrder: 2 },

      { name: 'REQUESTS', label: 'Requests', path: '/requests', icon: 'ClipboardCheck', parentName: null, sortOrder: 5 },
      { name: 'REPORTS', label: 'Reports', path: '/reports', icon: 'BarChart3', parentName: null, sortOrder: 6 },
    ];

    // =====================================================
    // 5.1 CREATE PARENT MENUS
    // =====================================================

    const menus = new Map<string, Menu>();

    for (const definition of menuDefinitions.filter(
      (menu) => menu.parentName === null,
    )) {
      let menu = await manager.findOne(Menu, {
        where: {
          name: definition.name,
        },
      });

      if (!menu) {
        menu = manager.create(Menu, {
          name: definition.name,
          label: definition.label,
          path: definition.path,
          icon: definition.icon,
          parentId: null,
          sortOrder: definition.sortOrder,
          isActive: true,
          isSystem: true,
        });

        menu = await manager.save(Menu, menu);

        console.log(`Created menu: ${menu.name}`);
      }

      menus.set(menu.name, menu);
    }

    // =====================================================
    // 5.2 CREATE CHILD MENUS
    // =====================================================

    for (const definition of menuDefinitions.filter(
      (menu) => menu.parentName !== null,
    )) {
      const parent = menus.get(definition.parentName!);

      if (!parent) {
        throw new Error(`Parent menu ${definition.parentName} not found`);
      }

      let menu = await manager.findOne(Menu, {
        where: {
          name: definition.name,
        },
      });

      if (!menu) {
        menu = manager.create(Menu, {
          name: definition.name,
          label: definition.label,
          path: definition.path,
          icon: definition.icon,
          parentId: parent.id,
          sortOrder: definition.sortOrder,
          isActive: true,
          isSystem: true,
        });

        menu = await manager.save(Menu, menu);

        console.log(`Created menu: ${menu.name}`);
      }

      menus.set(menu.name, menu);
    }

    // =====================================================
    // 5.3 ROLE -> MENUS
    // =====================================================
    // A child menu is only shown when its parent is also assigned,
    // so parents (INVENTORY, ACCESS_CONTROL) are listed too.
    // SUPER_ADMIN sees every active menu automatically.

    const roleMenuMap: Record<string, string[]> = {
      ADMIN: [
        'DASHBOARD',
        'INVENTORY',
        'PRODUCTS',
        'STOCK',
        'WAREHOUSES',
        'CATEGORIES',
        'BRANDS',
        'SUPPLIERS',
        'ADJUSTMENTS',
        'REQUESTS',
        'REPORTS',
        'STAFF',
        'ACCESS_CONTROL',
        'ROLES',
      ],

      MANAGER: [
        'DASHBOARD',
        'INVENTORY',
        'PRODUCTS',
        'STOCK',
        'WAREHOUSES',
        'CATEGORIES',
        'BRANDS',
        'SUPPLIERS',
        'ADJUSTMENTS',
        'REQUESTS',
        'REPORTS',
        'STAFF',
      ],

      STAFF: ['DASHBOARD', 'INVENTORY', 'PRODUCTS', 'STOCK', 'REQUESTS'],
    };

    for (const [roleName, menuNames] of Object.entries(roleMenuMap)) {
      const role = roles.get(roleName);

      if (!role) {
        throw new Error(`Role ${roleName} not found`);
      }

      for (const menuName of menuNames) {
        const menu = menus.get(menuName);

        if (!menu) {
          throw new Error(`Menu ${menuName} not found`);
        }

        const existing = await manager.findOne(RoleMenu, {
          where: {
            roleId: role.id,
            menuId: menu.id,
          },
        });

        if (!existing) {
          await manager.save(
            RoleMenu,
            manager.create(RoleMenu, {
              roleId: role.id,
              menuId: menu.id,
            }),
          );
        }
      }
    }

    // =====================================================
    // 6. CREATE SUPER ADMIN USER
    // =====================================================

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

    const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'System';

    const lastName = process.env.SUPER_ADMIN_LAST_NAME ?? 'Administrator';

    if (!superAdminEmail || !superAdminPassword) {
      throw new Error(
        'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required',
      );
    }

    let superAdminProfile = await manager.findOne(UserProfile, {
      where: {
        email: superAdminEmail,
      },
    });

    let superAdminUser: User;

    if (!superAdminProfile) {
      const result = await manager.query(`
        SELECT nextval('staff_id_seq') AS number
      `);

      const number = Number(result[0].number);

      const staffId = `KH${number.toString().padStart(4, '0')}`;

      const passwordHash = await bcrypt.hash(superAdminPassword, 12);

      superAdminUser = manager.create(User, {
        staffId,
        passwordHash,
      });

      superAdminUser = await manager.save(User, superAdminUser);

      superAdminProfile = manager.create(UserProfile, {
        userId: superAdminUser.id,
        firstName,
        lastName,
        email: superAdminEmail,
      });

      await manager.save(UserProfile, superAdminProfile);

      console.log(`Created Super Admin: ${staffId}`);
    } else {
      superAdminUser = await manager.findOneOrFail(User, {
        where: {
          id: superAdminProfile.userId,
        },
      });
    }

    // =====================================================
    // 7. ASSIGN SUPER_ADMIN ROLE
    // =====================================================

    const superAdminRole = roles.get('SUPER_ADMIN');

    if (!superAdminRole) {
      throw new Error('SUPER_ADMIN role not found');
    }

    const existingUserRole = await manager.findOne(UserRole, {
      where: {
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      },
    });

    if (!existingUserRole) {
      const userRole = manager.create(UserRole, {
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      });

      await manager.save(UserRole, userRole);
    }

    console.log('System seed completed successfully.');
  });
}
