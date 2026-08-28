import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';

import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';
import { Permission } from '../permissions/permission.entity';

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
  ) {}

  async findAll() {
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

    return this.rolePermissionRepository.find({
      where: {
        roleId: role.id,
      },
      relations: {
        permission: true,
      },
    });
  }
  async updatePermissions(roleId: string, permissionIds: string[]) {
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
}
