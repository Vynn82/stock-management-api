import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto) {
    const existing = await this.supplierRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Supplier code already exists');
    }

    const supplier = this.supplierRepository.create({
      ...dto,
      code: dto.code.toUpperCase(),
      name: dto.name.trim(),
    });

    return this.supplierRepository.save(supplier);
  }

  async findAll(paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(supplier.name ILIKE :search OR supplier.code ILIKE :search OR supplier.contactPerson ILIKE :search OR supplier.phone ILIKE :search OR supplier.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('supplier.name', 'ASC');
    queryBuilder.skip(skip).take(limit);

    const [suppliers, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResult(suppliers, total, paginationDto);
  }

  async findOne(id: string) {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.findOne(id);

    if (dto.code) {
      const code = dto.code.toUpperCase();

      const existing = await this.supplierRepository.findOne({
        where: { code },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Supplier code already exists');
      }

      dto.code = code;
    }

    if (dto.name) {
      const name = dto.name.trim();

      const existing = await this.supplierRepository.findOne({
        where: { name },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Supplier name already exists');
      }

      dto.name = name;
    }

    Object.assign(supplier, dto);

    return this.supplierRepository.save(supplier);
  }

  async deactivate(id: string) {
    const supplier = await this.findOne(id);

    if (!supplier.isActive) {
      return {
        message: 'Supplier is already inactive',
      };
    }

    supplier.isActive = false;

    await this.supplierRepository.save(supplier);

    return {
      message: 'Supplier deactivated successfully',
    };
  }

  async activate(id: string) {
    const supplier = await this.findOne(id);

    if (supplier.isActive) {
      return {
        message: 'Supplier is already active',
      };
    }

    supplier.isActive = true;

    await this.supplierRepository.save(supplier);

    return {
      message: 'Supplier activated successfully',
    };
  }
}
