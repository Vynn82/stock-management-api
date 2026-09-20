import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Category } from './entities/category.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  // =====================================================
  // CREATE
  // =====================================================

  async create(createCategoryDto: CreateCategoryDto) {
    const code = createCategoryDto.code.toUpperCase();
    const name = createCategoryDto.name.trim();

    const existing = await this.categoryRepository.findOne({
      where: [{ code }, { name }],
    });

    if (existing) {
      throw new ConflictException('Category code or name already exists');
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      code,
      name: name.trim(),
    });

    return this.categoryRepository.save(category);
  }

  // =====================================================
  // FIND ALL
  // =====================================================

  async findAll(paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(category.name ILIKE :search OR category.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('category.name', 'ASC');
    queryBuilder.skip(skip).take(limit);

    const [categories, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResult(categories, total, paginationDto);
  }

  // =====================================================
  // FIND ONE
  // =====================================================

  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  // =====================================================
  // UPDATE
  // =====================================================

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (updateCategoryDto.code) {
      const existingCode = await this.categoryRepository.findOne({
        where: {
          code: updateCategoryDto.code.toUpperCase(),
        },
      });

      if (existingCode && existingCode.id !== id) {
        throw new ConflictException('Category code already exists');
      }

      updateCategoryDto.code = updateCategoryDto.code.toUpperCase();
    }

    if (updateCategoryDto.name) {
      const existingName = await this.categoryRepository.findOne({
        where: {
          name: updateCategoryDto.name.trim(),
        },
      });

      if (existingName && existingName.id !== id) {
        throw new ConflictException('Category name already exists');
      }

      updateCategoryDto.name = updateCategoryDto.name.trim();
    }

    Object.assign(category, updateCategoryDto);

    return this.categoryRepository.save(category);
  }

  // =====================================================
  // DELETE
  // =====================================================

  async remove(id: string) {
    const category = await this.findOne(id);

    await this.categoryRepository.remove(category);

    return {
      message: 'Category deleted successfully',
    };
  }
  // =====================================================
  // DEACTIVATE
  // =====================================================

  async deactivate(id: string) {
    const category = await this.findOne(id);

    if (!category.isActive) {
      return {
        message: 'Category is already inactive',
      };
    }

    category.isActive = false;

    await this.categoryRepository.save(category);

    return {
      message: 'Category deactivated successfully',
    };
  }

  // =====================================================
  // ACTIVATE
  // =====================================================

  async activate(id: string) {
    const category = await this.findOne(id);

    if (category.isActive) {
      return {
        message: 'Category is already active',
      };
    }

    category.isActive = true;

    await this.categoryRepository.save(category);

    return {
      message: 'Category activated successfully',
    };
  }
}
