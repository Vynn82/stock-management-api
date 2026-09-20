import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';

import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';
import { Permission } from '../permissions/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleMenu } from './role-menu.entity';
import { Menu } from '../menu/menu.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,

    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,

    private readonly dataSource: DataSource,

    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  async findAll(paginationDto?: PaginationDto) {
    if (
      paginationDto &&
      (paginationDto.page || paginationDto.limit || paginationDto.search)
    ) {
      const { limit, skip } = getPaginationOptions(paginationDto);
      const search = paginationDto.search?.trim();

      const queryBuilder = this.roleRepository.createQueryBuilder('role');

      if (search) {
        queryBuilder.where('role.name ILIKE :search', {
          search: `%${search}%`,
        });
      }

      queryBuilder.orderBy('role.name', 'ASC').skip(skip).take(limit);

      const [roles, total] = await queryBuilder.getManyAndCount();

      return createPaginatedResult(roles, total, paginationDto);
    }

    return this.roleRepository.find({
      order: {
        name: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const role = await this.roleRepository.findOne({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async getPermissions(roleId: string) {
    const role = await this.findOne(roleId);

    const rolePermissions = await this.rolePermissionRepository.find({
      where: {
        roleId: role.id,
      },
      relations: {
        permission: true,
      },
    });

    return {
      role: {
        id: role.id,
        name: role.name,
      },

      permissions: rolePermissions.map(
        (rolePermission) => rolePermission.permission,
      ),
    };
  }
  async updatePermissionsOLD(roleId: string, permissionIds: string[]) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Remove duplicate permission IDs
    permissionIds = [...new Set(permissionIds)];

    // SUPER_ADMIN must always have every permission
    if (role.name === 'SUPER_ADMIN') {
      const allPermissions = await this.permissionRepository.find();

      permissionIds = allPermissions.map((permission) => permission.id);
    }

    // Verify permissions exist
    if (permissionIds.length > 0) {
      const permissions = await this.permissionRepository.find({
        where: {
          id: In(permissionIds),
        },
      });

      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('One or more permissions do not exist');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      // Remove existing permissions
      await manager.delete(RolePermission, {
        roleId,
      });

      // Add new permissions
      if (permissionIds.length > 0) {
        const rolePermissions = permissionIds.map((permissionId) =>
          manager.create(RolePermission, {
            roleId,
            permissionId,
          }),
        );

        await manager.save(RolePermission, rolePermissions);
      }
    });

    return this.getPermissions(roleId);
  }

  async addPermissions(roleId: string, permissionIds: string[]) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    permissionIds = [...new Set(permissionIds)];

    // SUPER_ADMIN always has all permissions
    if (role.name === 'SUPER_ADMIN') {
      throw new BadRequestException('SUPER_ADMIN already has all permissions');
    }

    // Verify permissions exist
    const permissions = await this.permissionRepository.find({
      where: {
        id: In(permissionIds),
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions do not exist');
    }

    // Find permissions the role already has
    const existingRolePermissions = await this.rolePermissionRepository.find({
      where: {
        roleId,
        permissionId: In(permissionIds),
      },
    });

    const existingPermissionIds = new Set(
      existingRolePermissions.map((item) => item.permissionId),
    );

    // Only add permissions that don't already exist
    const newPermissionIds = permissionIds.filter(
      (permissionId) => !existingPermissionIds.has(permissionId),
    );

    if (newPermissionIds.length > 0) {
      const rolePermissions = newPermissionIds.map((permissionId) =>
        this.rolePermissionRepository.create({
          roleId,
          permissionId,
        }),
      );

      await this.rolePermissionRepository.save(rolePermissions);
    }

    return {
      message: 'Permissions added successfully',
    };
  }
  // create role
  async create(createRoleDto: CreateRoleDto) {
    const { name } = createRoleDto;

    // Normalize role name
    const roleName = name.trim().toUpperCase();

    // Check duplicate role
    const existingRole = await this.roleRepository.findOne({
      where: {
        name: roleName,
      },
    });

    if (existingRole) {
      throw new BadRequestException('Role already exists');
    }

    // Create custom role
    const role = this.roleRepository.create({
      name: roleName,
      isSystem: false,
    });

    const savedRole = await this.roleRepository.save(role);

    return savedRole;
  }
  async getPermissionsForManagement(roleId: string) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Get ALL permissions
    const allPermissions = await this.permissionRepository.find({
      order: {
        resource: 'ASC',
        action: 'ASC',
      },
    });

    // Get permissions assigned to this role
    const rolePermissions = await this.rolePermissionRepository.find({
      where: {
        roleId,
      },
    });

    const assignedPermissionIds = new Set(
      rolePermissions.map((rolePermission) => rolePermission.permissionId),
    );

    // Group permissions by resource
    const resourceMap = new Map<
      string,
      {
        name: string;
        permissions: any[];
      }
    >();

    for (const permission of allPermissions) {
      if (!resourceMap.has(permission.resource)) {
        resourceMap.set(permission.resource, {
          name: permission.resource,
          permissions: [],
        });
      }

      resourceMap.get(permission.resource)!.permissions.push({
        id: permission.id,
        name: permission.name,
        action: permission.action,
        assigned: assignedPermissionIds.has(permission.id),
      });
    }

    return {
      role: {
        id: role.id,
        name: role.name,
      },

      resources: Array.from(resourceMap.values()),
    };
  }
  async removePermission(roleId: string, permissionId: string) {
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // SUPER_ADMIN must always keep all permissions
    if (role.name === 'SUPER_ADMIN') {
      throw new BadRequestException(
        'SUPER_ADMIN permissions cannot be removed',
      );
    }

    const rolePermission = await this.rolePermissionRepository.findOne({
      where: {
        roleId,
        permissionId,
      },
    });

    if (!rolePermission) {
      throw new NotFoundException('Permission is not assigned to this role');
    }

    await this.rolePermissionRepository.remove(rolePermission);

    return {
      message: 'Permission removed successfully',
    };
  }

  ///// role menu
  async getMenusOld(roleId: string) {
    const role = await this.findOne(roleId);

    const roleMenus = await this.roleMenuRepository.find({
      where: {
        roleId: role.id,
      },
      relations: {
        menu: true,
      },
      order: {
        menu: {
          sortOrder: 'ASC',
        },
      },
    });

    return roleMenus.map((roleMenu) => ({
      id: roleMenu.menu.id,
      name: roleMenu.menu.name,
      label: roleMenu.menu.label,
      path: roleMenu.menu.path,
      icon: roleMenu.menu.icon,
      parentId: roleMenu.menu.parentId,
      sortOrder: roleMenu.menu.sortOrder,
    }));
  }

  async getMenus(roleId: string) {
    const role = await this.findOne(roleId);

    const allMenus = await this.menuRepository.find({
      where: {
        isActive: true,
      },
      order: {
        sortOrder: 'ASC',
        name: 'ASC',
      },
    });

    let menus: Menu[];

    // SUPER_ADMIN automatically has ALL menus
    if (role.name === 'SUPER_ADMIN') {
      menus = allMenus;
    } else {
      const roleMenus = await this.roleMenuRepository.find({
        where: {
          roleId: role.id,
        },
        relations: {
          menu: true,
        },
      });

      menus = roleMenus
        .map((roleMenu) => roleMenu.menu)
        .filter((menu) => menu.isActive)
        .sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder;
          }

          return a.name.localeCompare(b.name);
        });
    }

    return this.buildMenuTree(menus);
  }

  async addMenu(roleId: string, menuId: string) {
    const role = await this.roleRepository.findOne({
      where: {
        id: roleId,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const menu = await this.dataSource.getRepository(Menu).findOne({
      where: {
        id: menuId,
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    const existing = await this.roleMenuRepository.findOne({
      where: {
        roleId,
        menuId,
      },
    });

    if (existing) {
      return {
        message: 'Menu already assigned to role',
      };
    }

    const roleMenu = this.roleMenuRepository.create({
      roleId,
      menuId,
    });

    await this.roleMenuRepository.save(roleMenu);

    return {
      message: 'Menu assigned successfully',
    };
  }
  async removeMenu(roleId: string, menuId: string) {
    const roleMenu = await this.roleMenuRepository.findOne({
      where: {
        roleId,
        menuId,
      },
    });

    if (!roleMenu) {
      throw new NotFoundException('Menu is not assigned to this role');
    }

    await this.roleMenuRepository.remove(roleMenu);

    return {
      message: 'Menu removed from role successfully',
    };
  }

  async getMenusForManagement(roleId: string) {
    const role = await this.findOne(roleId);

    const allMenus = await this.menuRepository.find({
      order: {
        sortOrder: 'ASC',
        name: 'ASC',
      },
    });

    let assignedMenuIds = new Set<string>();

    // SUPER_ADMIN automatically has ALL menus
    if (role.name === 'SUPER_ADMIN') {
      assignedMenuIds = new Set(allMenus.map((menu) => menu.id));
    } else {
      const roleMenus = await this.roleMenuRepository.find({
        where: {
          roleId: role.id,
        },
      });

      assignedMenuIds = new Set(roleMenus.map((roleMenu) => roleMenu.menuId));
    }

    const menuMap = new Map<string, any>();

    for (const menu of allMenus) {
      menuMap.set(menu.id, {
        id: menu.id,
        name: menu.name,
        label: menu.label,
        path: menu.path,
        icon: menu.icon,
        parentId: menu.parentId,
        sortOrder: menu.sortOrder,
        checked: assignedMenuIds.has(menu.id),
        children: [],
      });
    }

    const roots: any[] = [];

    for (const menu of allMenus) {
      const node = menuMap.get(menu.id);

      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId);

        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getMenusForManagementOLD(roleId: string) {
    const role = await this.findOne(roleId);

    const allMenus = await this.dataSource.getRepository(Menu).find({
      order: {
        sortOrder: 'ASC',
        name: 'ASC',
      },
    });

    const roleMenus = await this.roleMenuRepository.find({
      where: {
        roleId: role.id,
      },
    });

    const assignedMenuIds = new Set(
      roleMenus.map((roleMenu) => roleMenu.menuId),
    );

    const menuMap = new Map<string, any>();

    for (const menu of allMenus) {
      menuMap.set(menu.id, {
        id: menu.id,
        name: menu.name,
        label: menu.label,
        path: menu.path,
        icon: menu.icon,
        parentId: menu.parentId,
        sortOrder: menu.sortOrder,
        checked: assignedMenuIds.has(menu.id),
        children: [],
      });
    }

    const roots: any[] = [];

    for (const menu of allMenus) {
      const node = menuMap.get(menu.id);

      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId);

        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
  private buildMenuTree(menus: Menu[]) {
    const menuMap = new Map<string, any>();

    for (const menu of menus) {
      menuMap.set(menu.id, {
        id: menu.id,
        name: menu.name,
        label: menu.label,
        path: menu.path,
        icon: menu.icon,
        parentId: menu.parentId,
        sortOrder: menu.sortOrder,
        children: [],
      });
    }

    const roots: any[] = [];

    for (const menu of menus) {
      const node = menuMap.get(menu.id);

      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId);

        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
