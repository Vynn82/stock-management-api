import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { imageUploadOptions } from '../common/cloudinary/cloudinary-storage';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-roles.dto';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';
import { PaginationDto } from '../common/pagination';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @RequirePermission('USER_CREATE')
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.usersService.create(createUserDto, req.user.roles);
  }
  @RequirePermission('USER_VIEW')
  @Get(':id/roles')
  getRoles(@Param('id') id: string) {
    return this.usersService.getRoles(id);
  }

  @RequirePermission('USER_VIEW')
  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  // @Put(':id/role')
  // @RequirePermission('USER_ROLE_UPDATE')
  // updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
  //   return this.usersService.updateRole(id, dto.roleId);
  // }

  @Put(':id/role')
  @RequirePermission('USER_ROLE_UPDATE')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.usersService.updateRole(
      id,
      dto.roleId,
      req.user.sub,
      req.user.roles,
    );
  }

  @Get('me')
  getMe(@Req() req: authenticatedUserInterface.AuthenticatedRequest) {
    return this.usersService.getMe(req.user.sub);
  }

  /** The signed-in person edits their own name / email / phone. */
  @Patch('me')
  updateMe(
    @Body() dto: UpdateMyProfileDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.usersService.updateMe(req.user.sub, dto);
  }

  /** Changes the signed-in person's photo (multipart field "image"). */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  updateMyAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    if (!file?.path) {
      throw new BadRequestException('Image file is required (field "image")');
    }
    return this.usersService.updateMyAvatar(req.user.sub, file.path);
  }
}
