import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserRole } from './entities/user-role.entity';
import { Role } from '../roles/role.entity';
import { MailModule } from '../mail/mail.module';
import { Permission } from '../permissions/permission.entity';
import { RoleMenu } from '../roles/role-menu.entity';
import { Menu } from '../menu/menu.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProfile,
      UserRole,
      Role,
      Permission,
      Role,
      RoleMenu,
      Menu,
    ]),
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
