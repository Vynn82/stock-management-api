import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-roles.dto';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';
import { PaginationDto } from '../common/pagination';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
  @Get(':id/roles')
  getRoles(@Param('id') id: string) {
    return this.usersService.getRoles(id);
  }

  @RequirePermission('USER_VIEW')
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Put(':id/role')
  @RequirePermission('USER_ROLE_UPDATE')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto.roleId);
  }

  @Get('me')
  getMe(@Req() req: authenticatedUserInterface.AuthenticatedRequest) {
    return this.usersService.getMe(req.user.sub);
  }
}
