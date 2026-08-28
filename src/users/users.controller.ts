import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

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
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Put(':id/roles')
  updateRoles(@Param('id') id: string, @Body() dto: UpdateUserRolesDto) {
    return this.usersService.updateRoles(id, dto.roleIds);
  }
}
