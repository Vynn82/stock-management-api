import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  Query,
} from '@nestjs/common';

import { RolesService } from './roles.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { PaginationDto } from '../common/pagination';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.rolesService.findAll(query);
  }
  @RequirePermission('ROLE_CREATE')
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.rolesService.getPermissions(id);
  }
  @Post(':id/permissions')
  @RequirePermission('ROLE_UPDATE')
  addPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.addPermissions(id, dto.permissionIds);
  }

  @Get(':id/permissions/manage')
  @RequirePermission('ROLE_VIEW')
  getPermissionsForManagement(@Param('id') id: string) {
    return this.rolesService.getPermissionsForManagement(id);
  }

  @Delete(':roleId/permissions/:permissionId')
  @RequirePermission('ROLE_UPDATE')
  removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rolesService.removePermission(roleId, permissionId);
  }

  // ==========================================
  // MENUS
  // ==========================================

  @Get(':id/menus')
  getMenus(@Param('id') id: string) {
    return this.rolesService.getMenus(id);
  }

  @Get(':id/menus/manage')
  getMenusForManagement(@Param('id') id: string) {
    return this.rolesService.getMenusForManagement(id);
  }

  @Post(':roleId/menus/:menuId')
  addMenu(@Param('roleId') roleId: string, @Param('menuId') menuId: string) {
    return this.rolesService.addMenu(roleId, menuId);
  }

  @Delete(':roleId/menus/:menuId')
  removeMenu(@Param('roleId') roleId: string, @Param('menuId') menuId: string) {
    return this.rolesService.removeMenu(roleId, menuId);
  }
}
