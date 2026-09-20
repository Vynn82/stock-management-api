import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { UserProfile } from '../../users/entities/user-profile.entity';
import { UserRole } from '../../users/entities/user-role.entity';

import { Role } from '../../roles/role.entity';
import { RolePermission } from '../../roles/role-permission.entity';

import { Permission } from '../../permissions/permission.entity';

import { Menu } from '../../menu/menu.entity';

export async function seedSystem(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    console.log('Starting system seed...');

    // =====================================================
    // 1. PERMISSIONS
    // =====================================================

    const permissionDefinitions = [
      // ===================================================
      // PRODUCT
      // ===================================================

      {
        name: 'PRODUCT_CREATE',
        resource: 'product',
        action: 'create',
      },
      {
        name: 'PRODUCT_VIEW',
        resource: 'product',
        action: 'view',
      },
      {
        name: 'PRODUCT_UPDATE',
        resource: 'product',
        action: 'update',
      },
      {
        name: 'PRODUCT_DELETE',
        resource: 'product',
        action: 'delete',
      },

      // ===================================================
      // STAFF
      // ===================================================

      {
        name: 'STAFF_CREATE',
        resource: 'staff',
        action: 'create',
      },
      {
        name: 'STAFF_VIEW',
        resource: 'staff',
        action: 'view',
      },
      {
        name: 'STAFF_UPDATE',
        resource: 'staff',
        action: 'update',
      },
      {
        name: 'STAFF_DELETE',
        resource: 'staff',
        action: 'delete',
      },

      // ===================================================
      // ROLE
      // ===================================================

      {
        name: 'ROLE_CREATE',
        resource: 'role',
        action: 'create',
      },
      {
        name: 'ROLE_VIEW',
        resource: 'role',
        action: 'view',
      },
      {
        name: 'ROLE_UPDATE',
        resource: 'role',
        action: 'update',
      },
      {
        name: 'ROLE_DELETE',
        resource: 'role',
        action: 'delete',
      },

      // ===================================================
      // PERMISSION
      // ===================================================

      {
        name: 'PERMISSION_CREATE',
        resource: 'permission',
        action: 'create',
      },
      {
        name: 'PERMISSION_VIEW',
        resource: 'permission',
        action: 'view',
      },
      {
        name: 'PERMISSION_UPDATE',
        resource: 'permission',
        action: 'update',
      },
      {
        name: 'PERMISSION_DELETE',
        resource: 'permission',
        action: 'delete',
      },

      // ===================================================
      // MENU
      // ===================================================

      {
        name: 'MENU_CREATE',
        resource: 'menu',
        action: 'create',
      },
      {
        name: 'MENU_VIEW',
        resource: 'menu',
        action: 'view',
      },
      {
        name: 'MENU_UPDATE',
        resource: 'menu',
        action: 'update',
      },
      {
        name: 'MENU_DELETE',
        resource: 'menu',
        action: 'delete',
      },
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

    const rolePermissionMap: Record<string, string[]> = {
      // ===================================================
      // SUPER ADMIN
      // ===================================================

      SUPER_ADMIN: allPermissionNames,

      // ===================================================
      // ADMIN
      // ===================================================

      ADMIN: [
        // Staff
        'STAFF_CREATE',
        'STAFF_VIEW',
        'STAFF_UPDATE',
        'STAFF_DELETE',

        // Role
        'ROLE_CREATE',
        'ROLE_VIEW',
        'ROLE_UPDATE',
        'ROLE_DELETE',

        // Permission
        'PERMISSION_CREATE',
        'PERMISSION_VIEW',
        'PERMISSION_UPDATE',
        'PERMISSION_DELETE',

        // Menu
        'MENU_CREATE',
        'MENU_VIEW',
        'MENU_UPDATE',
        'MENU_DELETE',

        // Product
        'PRODUCT_CREATE',
        'PRODUCT_VIEW',
        'PRODUCT_UPDATE',
        'PRODUCT_DELETE',
      ],

      // ===================================================
      // MANAGER
      // ===================================================

      MANAGER: [
        // Staff
        'STAFF_CREATE',
        'STAFF_VIEW',

        // Product
        'PRODUCT_VIEW',
      ],

      // ===================================================
      // STAFF
      // ===================================================

      STAFF: ['PRODUCT_VIEW', 'PRODUCT_CREATE'],
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
      // ===================================================
      // DASHBOARD
      // ===================================================

      {
        name: 'DASHBOARD',
        label: 'Dashboard',
        path: '/dashboard',
        icon: 'LayoutDashboard',
        parentName: null,
        sortOrder: 1,
      },

      // ===================================================
      // INVENTORY
      // ===================================================

      {
        name: 'INVENTORY',
        label: 'Inventory',
        path: null,
        icon: 'Warehouse',
        parentName: null,
        sortOrder: 2,
      },

      {
        name: 'PRODUCTS',
        label: 'Products',
        path: '/products',
        icon: 'Package',
        parentName: 'INVENTORY',
        sortOrder: 1,
      },

      {
        name: 'STOCK',
        label: 'Stock',
        path: '/stock',
        icon: 'Boxes',
        parentName: 'INVENTORY',
        sortOrder: 2,
      },

      {
        name: 'WAREHOUSES',
        label: 'Warehouses',
        path: '/warehouses',
        icon: 'Building2',
        parentName: 'INVENTORY',
        sortOrder: 3,
      },

      // ===================================================
      // STAFF
      // ===================================================

      {
        name: 'STAFF',
        label: 'Staff',
        path: '/staff',
        icon: 'Users',
        parentName: null,
        sortOrder: 3,
      },

      // ===================================================
      // ACCESS CONTROL
      // ===================================================

      {
        name: 'ACCESS_CONTROL',
        label: 'Access Control',
        path: null,
        icon: 'Shield',
        parentName: null,
        sortOrder: 4,
      },

      {
        name: 'ROLES',
        label: 'Roles',
        path: '/roles',
        icon: 'ShieldCheck',
        parentName: 'ACCESS_CONTROL',
        sortOrder: 1,
      },

      {
        name: 'PERMISSIONS',
        label: 'Permissions',
        path: '/permissions',
        icon: 'KeyRound',
        parentName: 'ACCESS_CONTROL',
        sortOrder: 2,
      },
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
