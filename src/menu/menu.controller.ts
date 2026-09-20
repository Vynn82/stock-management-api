import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import { MenuService } from './menu.service';

import { CreateMenuDto } from './dto/create-menu-dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('menu')
export class MenusController {
  constructor(private readonly menuService: MenuService) {}

  // ==========================================
  // CREATE
  // ==========================================

  @RequirePermission('MENU_CREATE')
  @Post()
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.create(dto);
  }

  // ==========================================
  // GET ALL
  // ==========================================

  @RequirePermission('MENU_VIEW')
  @Get()
  findAll() {
    return this.menuService.findAll();
  }

  // ==========================================
  // GET ONE
  // ==========================================

  @RequirePermission('MENU_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.menuService.findOne(id);
  }

  // ==========================================
  // UPDATE
  // ==========================================

  @RequirePermission('MENU_UPDATE')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.menuService.update(id, dto);
  }

  // ==========================================
  // DELETE
  // ==========================================

  @RequirePermission('MENU_DELETE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menuService.remove(id);
  }
}
