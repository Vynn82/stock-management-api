import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Warehouse } from './entities/warehouse.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  // CREATE
  async create(dto: CreateWarehouseDto) {
    const existing = await this.warehouseRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Warehouse code already exists');
    }

    const warehouse = this.warehouseRepository.create({
      ...dto,
      code: dto.code.toUpperCase(),
      name: dto.name.trim(),
    });

    return this.warehouseRepository.save(warehouse);
  }

  // FIND ALL
  async findAll(paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.warehouseRepository
      .createQueryBuilder('warehouse')
      .where('warehouse.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(warehouse.name ILIKE :search OR warehouse.code ILIKE :search OR warehouse.address ILIKE :search OR warehouse.contactPerson ILIKE :search OR warehouse.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('warehouse.name', 'ASC');
    queryBuilder.skip(skip).take(limit);

    const [warehouses, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResult(warehouses, total, paginationDto);
  }

  // FIND ONE
  async findOne(id: string) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  // UPDATE
  async update(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.findOne(id);

    if (dto.code) {
      const code = dto.code.toUpperCase();

      const existing = await this.warehouseRepository.findOne({
        where: { code },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Warehouse code already exists');
      }

      dto.code = code;
    }

    if (dto.name) {
      const name = dto.name.trim();

      const existing = await this.warehouseRepository.findOne({
        where: { name },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Warehouse name already exists');
      }

      dto.name = name;
    }

    Object.assign(warehouse, dto);

    return this.warehouseRepository.save(warehouse);
  }

  // DEACTIVATE
  async deactivate(id: string) {
    const warehouse = await this.findOne(id);

    if (!warehouse.isActive) {
      return {
        message: 'Warehouse is already inactive',
      };
    }

    warehouse.isActive = false;

    await this.warehouseRepository.save(warehouse);

    return {
      message: 'Warehouse deactivated successfully',
    };
  }

  // ACTIVATE
  async activate(id: string) {
    const warehouse = await this.findOne(id);

    if (warehouse.isActive) {
      return {
        message: 'Warehouse is already active',
      };
    }

    warehouse.isActive = true;

    await this.warehouseRepository.save(warehouse);

    return {
      message: 'Warehouse activated successfully',
    };
  }
}
