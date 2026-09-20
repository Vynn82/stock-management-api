import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Menu } from './menu.entity';

import { CreateMenuDto } from './dto/create-menu-dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  // ==========================================
  // CREATE
  // ==========================================

  async create(dto: CreateMenuDto) {
    const name = dto.name.trim().toUpperCase();

    // Check duplicate
    const existing = await this.menuRepository.findOne({
      where: {
        name,
      },
    });

    if (existing) {
      throw new ConflictException('Menu already exists');
    }

    // Check parent
    if (dto.parentId) {
      const parent = await this.menuRepository.findOne({
        where: {
          id: dto.parentId,
        },
      });

      if (!parent) {
        throw new BadRequestException('Parent menu not found');
      }
    }

    const menu = this.menuRepository.create({
      name,
      label: dto.label.trim(),
      path: dto.path ?? null,
      icon: dto.icon ?? null,
      parentId: dto.parentId ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      isSystem: false,
    });

    return this.menuRepository.save(menu);
  }

  // ==========================================
  // FIND ALL - TREE
  // ==========================================

  async findAll() {
    const menus = await this.menuRepository.find({
      where: {
        isActive: true,
      },
      order: {
        sortOrder: 'ASC',
        name: 'ASC',
      },
    });
    return this.buildTree(menus);
  }

  // ==========================================
  // FIND ONE
  // ==========================================

  async findOne(id: string) {
    const menu = await this.menuRepository.findOne({
      where: {
        id,
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return menu;
  }

  // ==========================================
  // UPDATE
  // ==========================================

  async update(id: string, dto: UpdateMenuDto) {
    const menu = await this.findOne(id);

    if (menu.isSystem) {
      throw new BadRequestException('System menu cannot be modified');
    }

    // Check duplicate name
    if (dto.name) {
      const name = dto.name.trim().toUpperCase();

      const existing = await this.menuRepository.findOne({
        where: {
          name,
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Menu name already exists');
      }

      menu.name = name;
    }

    // Check parent
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Menu cannot be its own parent');
      }

      if (dto.parentId) {
        const parent = await this.menuRepository.findOne({
          where: {
            id: dto.parentId,
          },
        });

        if (!parent) {
          throw new BadRequestException('Parent menu not found');
        }
      }

      menu.parentId = dto.parentId;
    }

    if (dto.label !== undefined) {
      menu.label = dto.label.trim();
    }

    if (dto.path !== undefined) {
      menu.path = dto.path;
    }

    if (dto.icon !== undefined) {
      menu.icon = dto.icon;
    }

    if (dto.sortOrder !== undefined) {
      menu.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      menu.isActive = dto.isActive;
    }

    return this.menuRepository.save(menu);
  }

  // ==========================================
  // DELETE
  // ==========================================

  async remove(id: string) {
    const menu = await this.findOne(id);

    if (menu.isSystem) {
      throw new BadRequestException('System menu cannot be deleted');
    }

    await this.menuRepository.remove(menu);

    return {
      message: 'Menu deleted successfully',
    };
  }

  // ==========================================
  // BUILD TREE
  // ==========================================

  private buildTree(menus: Menu[]) {
    const map = new Map<string, any>();
    const roots: any[] = [];

    // Create nodes
    for (const menu of menus) {
      map.set(menu.id, {
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

    // Build tree
    for (const menu of menus) {
      const node = map.get(menu.id);

      if (menu.parentId) {
        const parent = map.get(menu.parentId);

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
