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
        description: 'Create users',
      },
      {
        name: 'USER_VIEW',
        resource: 'users',
        action: 'view',
        description: 'View users',
      },
      {
        name: 'USER_UPDATE',
        resource: 'users',
        action: 'update',
        description: 'Update users',
      },
      {
        name: 'USER_DELETE',
        resource: 'users',
        action: 'delete',
        description: 'Delete users',
      },

      // Roles
      {
        name: 'ROLE_CREATE',
        resource: 'roles',
        action: 'create',
        description: 'Create roles',
      },
      {
        name: 'ROLE_VIEW',
        resource: 'roles',
        action: 'view',
        description: 'View roles',
      },
      {
        name: 'ROLE_UPDATE',
        resource: 'roles',
        action: 'update',
        description: 'Update roles',
      },
      {
        name: 'ROLE_DELETE',
        resource: 'roles',
        action: 'delete',
        description: 'Delete roles',
      },

      // Products
      {
        name: 'PRODUCT_CREATE',
        resource: 'products',
        action: 'create',
        description: 'Create products',
      },
      {
        name: 'PRODUCT_VIEW',
        resource: 'products',
        action: 'view',
        description: 'View products',
      },
      {
        name: 'PRODUCT_UPDATE',
        resource: 'products',
        action: 'update',
        description: 'Update products',
      },
      {
        name: 'PRODUCT_DELETE',
        resource: 'products',
        action: 'delete',
        description: 'Delete products',
      },

      // Stock
      {
        name: 'STOCK_VIEW',
        resource: 'stock',
        action: 'view',
        description: 'View stock',
      },
      {
        name: 'STOCK_ADJUST',
        resource: 'stock',
        action: 'adjust',
        description: 'Adjust stock',
      },
      {
        name: 'STOCK_TRANSFER',
        resource: 'stock',
        action: 'transfer',
        description: 'Transfer stock',
      },

      // Orders
      {
        name: 'ORDER_CREATE',
        resource: 'orders',
        action: 'create',
        description: 'Create orders',
      },
      {
        name: 'ORDER_VIEW',
        resource: 'orders',
        action: 'view',
        description: 'View orders',
      },
      {
        name: 'ORDER_UPDATE',
        resource: 'orders',
        action: 'update',
        description: 'Update orders',
      },
      {
        name: 'ORDER_CANCEL',
        resource: 'orders',
        action: 'cancel',
        description: 'Cancel orders',
      },
      {
        name: 'ORDER_APPROVE',
        resource: 'orders',
        action: 'approve',
        description: 'Approve orders',
      },

      // Import
      {
        name: 'IMPORT_CREATE',
        resource: 'imports',
        action: 'create',
        description: 'Create imports',
      },
      {
        name: 'IMPORT_VIEW',
        resource: 'imports',
        action: 'view',
        description: 'View imports',
      },
      {
        name: 'IMPORT_APPROVE',
        resource: 'imports',
        action: 'approve',
        description: 'Approve imports',
      },
      {
        name: 'IMPORT_REJECT',
        resource: 'imports',
        action: 'reject',
        description: 'Reject imports',
      },

      // Files
      {
        name: 'FILE_VIEW',
        resource: 'files',
        action: 'view',
        description: 'View files',
      },
      {
        name: 'FILE_DOWNLOAD',
        resource: 'files',
        action: 'download',
        description: 'Download files',
      },
      {
        name: 'FILE_DELETE',
        resource: 'files',
        action: 'delete',
        description: 'Delete files',
      },

      // Reports
      {
        name: 'REPORT_VIEW',
        resource: 'reports',
        action: 'view',
        description: 'View reports',
      },
      {
        name: 'REPORT_EXPORT',
        resource: 'reports',
        action: 'export',
        description: 'Export reports',
      },

      // Payments
      {
        name: 'PAYMENT_VIEW',
        resource: 'payments',
        action: 'view',
        description: 'View payments',
      },
      {
        name: 'PAYMENT_CREATE',
        resource: 'payments',
        action: 'create',
        description: 'Create payments',
      },
      {
        name: 'PAYMENT_UPDATE',
        resource: 'payments',
        action: 'update',
        description: 'Update payments',
      },
      {
        name: 'PAYMENT_APPROVE',
        resource: 'payments',
        action: 'approve',
        description: 'Approve payments',
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
        description: 'Full access to the entire system',
      },
      {
        name: 'ADMIN',
        description: 'Administrative and operational access',
      },
      {
        name: 'MANAGER',
        description: 'Management and approval access',
      },
      {
        name: 'HR',
        description: 'Human resource management access',
      },
      {
        name: 'ACCOUNT',
        description: 'Accounting and payment access',
      },
      {
        name: 'STAFF',
        description: 'Basic operational access',
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
          description: definition.description,
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
      SUPER_ADMIN: allPermissionNames,

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
      ],

      MANAGER: [
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

      HR: [
        'USER_CREATE',
        'USER_VIEW',
        'USER_UPDATE',

        'FILE_VIEW',
        'FILE_DOWNLOAD',
      ],

      ACCOUNT: [
        'ORDER_VIEW',

        'PAYMENT_VIEW',
        'PAYMENT_CREATE',
        'PAYMENT_UPDATE',
        'PAYMENT_APPROVE',

        'REPORT_VIEW',
        'REPORT_EXPORT',
      ],

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

      const staffId = `ABC${number.toString().padStart(5, '0')}`;

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