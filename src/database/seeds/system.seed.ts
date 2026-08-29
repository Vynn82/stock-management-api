import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { UserProfile } from '../../users/entities/user-profile.entity';
import { UserRole } from '../../users/entities/user-role.entity';

import { Role } from '../../roles/role.entity';
import { RolePermission } from '../../roles/role-permission.entity';

import { Permission } from '../../permissions/permission.entity';

export async function seedSystem(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    console.log('Starting system seed...');

    // =====================================================
    // 1. PERMISSIONS
    // =====================================================

    const permissionDefinitions = [
      // Users
      {
        name: 'USER_CREATE',
        resource: 'users',
        action: 'create',
      },
      {
        name: 'USER_VIEW',
        resource: 'users',
        action: 'view',
      },
      {
        name: 'USER_UPDATE',
        resource: 'users',
        action: 'update',
      },
      {
        name: 'USER_DELETE',
        resource: 'users',
        action: 'delete',
      },

      // Roles
      {
        name: 'ROLE_CREATE',
        resource: 'roles',
        action: 'create',
      },
      {
        name: 'ROLE_VIEW',
        resource: 'roles',
        action: 'view',
      },
      {
        name: 'ROLE_UPDATE',
        resource: 'roles',
        action: 'update',
      },
      {
        name: 'ROLE_DELETE',
        resource: 'roles',
        action: 'delete',
      },

      // Products
      {
        name: 'PRODUCT_CREATE',
        resource: 'products',
        action: 'create',
      },
      {
        name: 'PRODUCT_VIEW',
        resource: 'products',
        action: 'view',
      },
      {
        name: 'PRODUCT_UPDATE',
        resource: 'products',
        action: 'update',
      },
      {
        name: 'PRODUCT_DELETE',
        resource: 'products',
        action: 'delete',
      },

      // Stock
      {
        name: 'STOCK_VIEW',
        resource: 'stock',
        action: 'view',
      },
      {
        name: 'STOCK_ADJUST',
        resource: 'stock',
        action: 'adjust',
      },
      {
        name: 'STOCK_TRANSFER',
        resource: 'stock',
        action: 'transfer',
      },

      // Orders
      {
        name: 'ORDER_CREATE',
        resource: 'orders',
        action: 'create',
      },
      {
        name: 'ORDER_VIEW',
        resource: 'orders',
        action: 'view',
      },
      {
        name: 'ORDER_UPDATE',
        resource: 'orders',
        action: 'update',
      },
      {
        name: 'ORDER_CANCEL',
        resource: 'orders',
        action: 'cancel',
      },
      {
        name: 'ORDER_APPROVE',
        resource: 'orders',
        action: 'approve',
      },

      // Import
      {
        name: 'IMPORT_CREATE',
        resource: 'imports',
        action: 'create',
      },
      {
        name: 'IMPORT_VIEW',
        resource: 'imports',
        action: 'view',
      },
      {
        name: 'IMPORT_APPROVE',
        resource: 'imports',
        action: 'approve',
      },
      {
        name: 'IMPORT_REJECT',
        resource: 'imports',
        action: 'reject',
      },

      // Files
      {
        name: 'FILE_VIEW',
        resource: 'files',
        action: 'view',
      },
      {
        name: 'FILE_DOWNLOAD',
        resource: 'files',
        action: 'download',
      },
      {
        name: 'FILE_DELETE',
        resource: 'files',
        action: 'delete',
      },

      // Reports
      {
        name: 'REPORT_VIEW',
        resource: 'reports',
        action: 'view',
      },
      {
        name: 'REPORT_EXPORT',
        resource: 'reports',
        action: 'export',
      },

      // Payments
      {
        name: 'PAYMENT_VIEW',
        resource: 'payments',
        action: 'view',
      },
      {
        name: 'PAYMENT_CREATE',
        resource: 'payments',
        action: 'create',
      },
      {
        name: 'PAYMENT_UPDATE',
        resource: 'payments',
        action: 'update',
      },
      {
        name: 'PAYMENT_APPROVE',
        resource: 'payments',
        action: 'approve',
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
      }

      roles.set(role.name, role);
    }

    // =====================================================
    // 4. ROLE → PERMISSIONS
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
        'USER_CREATE',
        'USER_VIEW',
        'USER_UPDATE',
        'USER_DELETE',

        'ROLE_CREATE',
        'ROLE_VIEW',
        'ROLE_UPDATE',
        'ROLE_DELETE',

        'PRODUCT_CREATE',
        'PRODUCT_VIEW',
        'PRODUCT_UPDATE',
        'PRODUCT_DELETE',

        'STOCK_VIEW',
        'STOCK_ADJUST',
        'STOCK_TRANSFER',

        'ORDER_CREATE',
        'ORDER_VIEW',
        'ORDER_UPDATE',
        'ORDER_CANCEL',
        'ORDER_APPROVE',

        'IMPORT_CREATE',
        'IMPORT_VIEW',
        'IMPORT_APPROVE',
        'IMPORT_REJECT',

        'FILE_VIEW',
        'FILE_DOWNLOAD',
        'FILE_DELETE',

        'REPORT_VIEW',
        'REPORT_EXPORT',

        'PAYMENT_VIEW',
        'PAYMENT_CREATE',
        'PAYMENT_UPDATE',
        'PAYMENT_APPROVE',
      ],

      // ===================================================
      // MANAGER
      // ===================================================

      MANAGER: [
        'USER_CREATE',
        'USER_VIEW',

        'PRODUCT_VIEW',

        'STOCK_VIEW',
        'STOCK_ADJUST',
        'STOCK_TRANSFER',

        'ORDER_CREATE',
        'ORDER_VIEW',
        'ORDER_UPDATE',
        'ORDER_APPROVE',

        'IMPORT_VIEW',
        'IMPORT_APPROVE',
        'IMPORT_REJECT',

        'FILE_VIEW',
        'FILE_DOWNLOAD',

        'REPORT_VIEW',
        'REPORT_EXPORT',
      ],

      // ===================================================
      // STAFF
      // ===================================================

      STAFF: ['PRODUCT_VIEW', 'STOCK_VIEW', 'ORDER_CREATE', 'ORDER_VIEW'],
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
    // 5. CREATE SUPER ADMIN USER
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

      const staffId = `KH${number.toString().padStart(5, '0')}`;

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
    // 6. ASSIGN SUPER_ADMIN ROLE
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
