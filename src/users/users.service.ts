import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserRole } from './entities/user-role.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../roles/role.entity';
import { MailService } from '../mail/mail.service';
import { Permission } from '../permissions/permission.entity';
import { RoleMenu } from '../roles/role-menu.entity';
import { Menu } from '../menu/menu.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,

    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RoleMenu)
    private readonly roleMenuRepository: Repository<RoleMenu>,

    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) {}

  async findAll(paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role');

    if (search) {
      queryBuilder.andWhere(
        '(user.staffId ILIKE :search OR profile.firstName ILIKE :search OR profile.lastName ILIKE :search OR profile.email ILIKE :search OR profile.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResult(users, total, paginationDto);
  }

  async create(createUserDto: CreateUserDto) {
    const { firstName, lastName, email, phone, telegramChatId } = createUserDto;

    // 1. Check email
    const existingProfile = await this.userProfileRepository.findOne({
      where: { email },
    });

    if (existingProfile) {
      throw new ConflictException('Email already exists');
    }

    // 2. Get default STAFF role
    const staffRole = await this.roleRepository.findOne({
      where: {
        name: 'STAFF',
      },
    });

    if (!staffRole) {
      throw new NotFoundException('STAFF role not found');
    }

    // 3. Get next staff number
    const result = await this.dataSource.query(`
      SELECT nextval('staff_id_seq') AS number
    `);

    const number = Number(result[0].number);

    // 4. Generate staff ID
    const staffId = `KH${number.toString().padStart(4, '0')}`;

    // 5. Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();

    // 6. Hash password
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    // 7. Generate avatar
    const avatarUrl = this.generateAvatar(firstName, lastName);

    // 8. Save User + Profile + Default Role
    await this.dataSource.transaction(async (manager) => {
      // Create User
      const user = manager.create(User, {
        staffId,
        passwordHash,
      });

      const savedUser = await manager.save(User, user);

      // Create Profile
      const profile = manager.create(UserProfile, {
        userId: savedUser.id,
        firstName,
        lastName,
        avatar: avatarUrl,
        email,
        phone: phone ?? null,
        telegramChatId: telegramChatId ?? null,
      });

      await manager.save(UserProfile, profile);

      // Assign default STAFF role
      const userRole = manager.create(UserRole, {
        userId: savedUser.id,
        roleId: staffRole.id,
      });

      await manager.save(UserRole, userRole);
    });

    // 9. Send welcome email
    // await this.mailService.sendWelcomeEmail(
    //   email,
    //   firstName,
    //   lastName,
    //   staffId,
    //   temporaryPassword,
    // );

    // 9. Send welcome email (don't let mail failure break user creation)
    try {
      await this.mailService.sendWelcomeEmail(
        email,
        firstName,
        lastName,
        staffId,
        temporaryPassword,
      );
    } catch (error:any) {
      console.error('Failed to send welcome email:', error.message);
    }

    // 10. Temporary response for testing
    return {
      staffId,
      temporaryPassword,
    };
  }

  async getRoles(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.userRoleRepository.find({
      where: {
        userId: user.id,
      },
      relations: {
        role: true,
      },
    });
  }

  async updateRole(userId: string, roleId: string) {
    // 1. Check user
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Check role
    const role = await this.roleRepository.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new BadRequestException('Role does not exist');
    }

    // 3. Replace user's role
    await this.dataSource.transaction(async (manager) => {
      // Remove current role
      await manager.delete(UserRole, {
        userId,
      });

      // Assign new role
      const userRole = manager.create(UserRole, {
        userId,
        roleId,
      });

      await manager.save(UserRole, userRole);
    });

    return this.getRoles(userId);
  }
  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
      relations: {
        profile: true,
        userRoles: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ==========================================
    // ROLES
    // ==========================================

    const roles = user.userRoles.map((userRole) => userRole.role.name);

    // ==========================================
    // PERMISSIONS
    // ==========================================

    let permissions: string[];

    if (roles.includes('SUPER_ADMIN')) {
      const allPermissions = await this.permissionRepository.find({
        order: {
          resource: 'ASC',
          action: 'ASC',
        },
      });

      permissions = allPermissions.map((permission) => permission.name);
    } else {
      permissions = [
        ...new Set(
          user.userRoles.flatMap((userRole) =>
            userRole.role.rolePermissions.map(
              (rolePermission) => rolePermission.permission.name,
            ),
          ),
        ),
      ];
    }

    // ==========================================
    // MENUS
    // ==========================================

    let menus: Menu[];

    if (roles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN automatically sees ALL menus
      menus = await this.menuRepository.find({
        where: {
          isActive: true,
        },
        order: {
          sortOrder: 'ASC',
          name: 'ASC',
        },
      });
    } else {
      // Other roles only see assigned menus
      const roleMenus = await this.roleMenuRepository.find({
        where: user.userRoles.map((userRole) => ({
          roleId: userRole.roleId,
        })),
        relations: {
          menu: true,
        },
      });

      menus = roleMenus
        .map((roleMenu) => roleMenu.menu)
        .filter((menu) => menu.isActive);
    }

    // ==========================================
    // BUILD MENU TREE
    // ==========================================

    const menuMap = new Map<string, any>();

    for (const menu of menus) {
      menuMap.set(menu.id, {
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

    const menuTree: any[] = [];

    for (const menu of menus) {
      const currentMenu = menuMap.get(menu.id);

      if (menu.parentId) {
        const parentMenu = menuMap.get(menu.parentId);

        if (parentMenu) {
          parentMenu.children.push(currentMenu);
        }
      } else {
        menuTree.push(currentMenu);
      }
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    return {
      id: user.id,
      staffId: user.staffId,
      status: user.status,
      mustChangePassword: user.mustChangePassword,

      profile: user.profile,

      roles,
      permissions,

      menus: menuTree,
    };
  }
  async getMeOLD2(userId: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
      relations: {
        profile: true,
        userRoles: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.userRoles.map((userRole) => userRole.role.name);

    let permissions: string[];

    // SUPER_ADMIN automatically has ALL permissions
    if (roles.includes('SUPER_ADMIN')) {
      const allPermissions = await this.permissionRepository.find({
        order: {
          resource: 'ASC',
          action: 'ASC',
        },
      });

      permissions = allPermissions.map((permission) => permission.name);
    } else {
      permissions = [
        ...new Set(
          user.userRoles.flatMap((userRole) =>
            userRole.role.rolePermissions.map(
              (rolePermission) => rolePermission.permission.name,
            ),
          ),
        ),
      ];
    }

    return {
      id: user.id,
      staffId: user.staffId,
      status: user.status,
      mustChangePassword: user.mustChangePassword,

      profile: user.profile,

      roles,
      permissions,
    };
  }

  async getMeOld(userId: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
      relations: {
        profile: true,
        userRoles: {
          role: {
            rolePermissions: {
              permission: true,
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.userRoles.map((userRole) => userRole.role.name);

    const permissions = [
      ...new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map(
            (rolePermission) => rolePermission.permission.name,
          ),
        ),
      ),
    ];

    return {
      id: user.id,
      staffId: user.staffId,
      status: user.status,
      mustChangePassword: user.mustChangePassword,

      profile: user.profile,

      roles,
      permissions,
    };
  }

  // =========================
  // Helper methods
  // =========================

  private generateTemporaryPassword(): string {
    return `${this.randomString(4)}${this.randomString(4)}!`;
  }

  private randomString(length: number): string {
    const characters =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    return result;
  }

  private generateAvatar(firstName: string, lastName: string): string {
    const initials =
      `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    return `https://ui-avatars.com/api/?name=${initials}&background=random`;
  }
}
