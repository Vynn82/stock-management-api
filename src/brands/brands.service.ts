import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Brand } from './entities/brand.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
  ) {}

  // =====================================================
  // CREATE
  // =====================================================

  async create(createBrandDto: CreateBrandDto) {
    const code = createBrandDto.code.toUpperCase();
    const name = createBrandDto.name.trim();

    const existing = await this.brandRepository.findOne({
      where: [{ code }, { name }],
    });

    if (existing) {
      throw new ConflictException('Brand code or name already exists');
    }

    const brand = this.brandRepository.create({
      ...createBrandDto,
      code,
      name,
    });

    return this.brandRepository.save(brand);
  }

  // =====================================================
  // FIND ALL
  // =====================================================

  async findAll(paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.brandRepository
      .createQueryBuilder('brand')
      .where('brand.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(brand.name ILIKE :search OR brand.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('brand.name', 'ASC');
    queryBuilder.skip(skip).take(limit);

    const [brands, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResult(brands, total, paginationDto);
  }

  // =====================================================
  // FIND ONE
  // =====================================================

  async findOne(id: string) {
    const brand = await this.brandRepository.findOne({
      where: {
        id,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  // =====================================================
  // UPDATE
  // =====================================================

  async update(id: string, updateBrandDto: UpdateBrandDto) {
    const brand = await this.findOne(id);

    if (updateBrandDto.code) {
      const code = updateBrandDto.code.toUpperCase();

      const existingCode = await this.brandRepository.findOne({
        where: {
          code,
        },
      });

      if (existingCode && existingCode.id !== id) {
        throw new ConflictException('Brand code already exists');
      }

      updateBrandDto.code = code;
    }

    if (updateBrandDto.name) {
      const name = updateBrandDto.name.trim();

      const existingName = await this.brandRepository.findOne({
        where: {
          name,
        },
      });

      if (existingName && existingName.id !== id) {
        throw new ConflictException('Brand name already exists');
      }

      updateBrandDto.name = name;
    }

    Object.assign(brand, updateBrandDto);

    return this.brandRepository.save(brand);
  }

  // =====================================================
  // DEACTIVATE
  // =====================================================

  async deactivate(id: string) {
    const brand = await this.findOne(id);

    if (!brand.isActive) {
      return {
        message: 'Brand is already inactive',
      };
    }

    brand.isActive = false;

    await this.brandRepository.save(brand);

    return {
      message: 'Brand deactivated successfully',
    };
  }

  // =====================================================
  // ACTIVATE
  // =====================================================

  async activate(id: string) {
    const brand = await this.findOne(id);

    if (brand.isActive) {
      return {
        message: 'Brand is already active',
      };
    }

    brand.isActive = true;

    await this.brandRepository.save(brand);

    return {
      message: 'Brand activated successfully',
    };
  }
}
