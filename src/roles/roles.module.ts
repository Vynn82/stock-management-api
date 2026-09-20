import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolePermission } from './role-permission.entity';
import { Permission } from '../permissions/permission.entity';
import { RoleMenu } from './role-menu.entity';
import { Menu } from '../menu/menu.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      RolePermission,
      Permission,
      RoleMenu,
      Menu,
    ]),
  ],

  providers: [RolesService],
  exports: [RolesService],
  controllers: [RolesController],
})
export class RolesModule {}
