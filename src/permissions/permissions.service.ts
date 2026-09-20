import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Permission } from './permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(paginationDto?: PaginationDto) {
    if (
      paginationDto &&
      (paginationDto.page || paginationDto.limit || paginationDto.search)
    ) {
      const { limit, skip } = getPaginationOptions(paginationDto);
      const search = paginationDto.search?.trim();

      const queryBuilder =
        this.permissionRepository.createQueryBuilder('permission');

      if (search) {
        queryBuilder.where(
          '(permission.name ILIKE :search OR permission.resource ILIKE :search OR permission.action ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      queryBuilder
        .orderBy('permission.resource', 'ASC')
        .addOrderBy('permission.action', 'ASC')
        .skip(skip)
        .take(limit);

      const [permissions, total] = await queryBuilder.getManyAndCount();

      return createPaginatedResult(permissions, total, paginationDto);
    }

    return this.permissionRepository.find({
      order: {
        resource: 'ASC',
        action: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async create(createPermissionDto: CreatePermissionDto) {
    const resource = createPermissionDto.resource.trim().toLowerCase();

    const action = createPermissionDto.action.trim().toLowerCase();

    // Check duplicate
    const existingPermission = await this.permissionRepository.findOne({
      where: {
        resource,
        action,
      },
    });

    if (existingPermission) {
      throw new BadRequestException('Permission already exists');
    }

    const permission = this.permissionRepository.create({
      name: `${resource}_${action}`.toUpperCase(),
      resource,
      action,
    });

    return this.permissionRepository.save(permission);
  }
  async createBulk(dtos: CreatePermissionDto[]) {
    if (!dtos || dtos.length === 0) {
      throw new BadRequestException('At least one permission is required');
    }

    // Normalize
    const permissions = dtos.map((dto) => ({
      resource: dto.resource.trim().toLowerCase(),
      action: dto.action.trim().toLowerCase(),
    }));

    // ==========================================
    // Check duplicates inside request
    // ==========================================

    const keys = permissions.map(
      (permission) => `${permission.resource}:${permission.action}`,
    );

    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate permissions found in request');
    }

    // ==========================================
    // Check existing permissions in database
    // ==========================================

    const existingPermissions = await this.permissionRepository.find({
      where: permissions.map((permission) => ({
        resource: permission.resource,
        action: permission.action,
      })),
    });

    if (existingPermissions.length > 0) {
      const existingNames = existingPermissions.map(
        (permission) => permission.name,
      );

      throw new BadRequestException(
        `Permissions already exist: ${existingNames.join(', ')}`,
      );
    }

    // ==========================================
    // Create all permissions
    // ==========================================

    const entities = permissions.map((permission) =>
      this.permissionRepository.create({
        name: `${permission.resource}_${permission.action}`.toUpperCase(),
        resource: permission.resource,
        action: permission.action,
      }),
    );

    // ==========================================
    // Transaction
    // ==========================================

    return this.dataSource.transaction(async (manager) => {
      return manager.save(Permission, entities);
    });
  }
  async createResource(resourceName: string) {
    const resource = resourceName.trim().toLowerCase();

    if (!resource) {
      throw new BadRequestException('Resource is required');
    }

    const actions = ['view', 'create', 'update', 'delete'];

    // Check if resource already exists
    const existingPermissions = await this.permissionRepository.find({
      where: {
        resource,
      },
    });

    if (existingPermissions.length > 0) {
      throw new BadRequestException(`Resource "${resource}" already exists`);
    }

    const permissions = actions.map((action) =>
      this.permissionRepository.create({
        resource,
        action,
        name: `${resource}_${action}`.toUpperCase(),
      }),
    );

    return this.dataSource.transaction(async (manager) => {
      return manager.save(Permission, permissions);
    });
  }
}
