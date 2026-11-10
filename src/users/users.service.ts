import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserStatus } from './entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserRole } from './entities/user-role.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { deleteCloudinaryImage } from '../common/cloudinary/cloudinary.utils';
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

const ROLE_ASSIGNMENT_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ['MANAGER', 'STAFF'],
  ADMIN: ['MANAGER', 'STAFF'],
  MANAGER: ['STAFF'],
};

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

  async create(createUserDto: CreateUserDto, requesterRoles: string[]) {
    const { firstName, lastName, email, phone, telegramChatId, roleId } =
      createUserDto;

    // 1. Check email
    const existingProfile = await this.userProfileRepository.findOne({
      where: { email },
    });

    if (existingProfile) {
      throw new ConflictException('Email already exists');
    }

    // 2. Resolve target role (default STAFF) and check permission
    const targetRole = roleId
      ? await this.roleRepository.findOne({ where: { id: roleId } })
      : await this.roleRepository.findOne({ where: { name: 'STAFF' } });

    if (!targetRole) {
      throw new NotFoundException('Role not found');
    }

    const isSuperAdmin = requesterRoles.includes('SUPER_ADMIN');
    const allowedTargets = requesterRoles.flatMap(
      (r) => ROLE_ASSIGNMENT_MAP[r] ?? [],
    );

    if (!isSuperAdmin && !allowedTargets.includes(targetRole.name)) {
      throw new ForbiddenException(
        `You are not allowed to create a user with role ${targetRole.name}`,
      );
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

      // Assign selected role
      const userRole = manager.create(UserRole, {
        userId: savedUser.id,
        roleId: targetRole.id,
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
    } catch (error: any) {
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

  // async updateRole(userId: string, roleId: string, sub: string, roles: string[]) {
  //   // 1. Check user
  //   const user = await this.userRepository.findOne({
  //     where: { id: userId },
  //   });

  //   if (!user) {
  //     throw new NotFoundException('User not found');
  //   }

  //   // 2. Check role
  //   const role = await this.roleRepository.findOne({
  //     where: { id: roleId },
  //   });

  //   if (!role) {
  //     throw new BadRequestException('Role does not exist');
  //   }

  //   // 3. Replace user's role
  //   await this.dataSource.transaction(async (manager) => {
  //     // Remove current role
  //     await manager.delete(UserRole, {
  //       userId,
  //     });

  //     // Assign new role
  //     const userRole = manager.create(UserRole, {
  //       userId,
  //       roleId,
  //     });

  //     await manager.save(UserRole, userRole);
  //   });

  //   return this.getRoles(userId);
  // }

  async updateRole(
  userId: string,
  roleId: string,
  requesterId: string,
  requesterRoles: string[],
) {
  // 0. Nobody can change their own role
  if (userId === requesterId) {
    throw new ForbiddenException('You cannot change your own role');
  }

  // 1. Check user
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) {
    throw new NotFoundException('User not found');
  }

  // 2. Check role
  const role = await this.roleRepository.findOne({ where: { id: roleId } });
  if (!role) {
    throw new BadRequestException('Role does not exist');
  }

  // 3. Hierarchy check (SUPER_ADMIN can manage everyone)
  if (!requesterRoles.includes('SUPER_ADMIN')) {
    const allowedTargets = requesterRoles.flatMap(
      (r) => ROLE_ASSIGNMENT_MAP[r] ?? [],
    );

    // 3a. requester may assign the NEW role
    if (!allowedTargets.includes(role.name)) {
      throw new ForbiddenException(
        `You are not allowed to assign role ${role.name}`,
      );
    }

    // 3b. requester may manage the user's CURRENT role
    const currentRoles = await this.getRoles(userId);
    const currentNames = currentRoles.map((ur) => ur.role.name);

    if (!currentNames.every((name) => allowedTargets.includes(name))) {
      throw new ForbiddenException(
        'You are not allowed to change this user\'s role',
      );
    }
  }

  // 4. Replace user's role (keep your existing transaction as-is)
  await this.dataSource.transaction(async (manager) => {
    await manager.delete(UserRole, { userId });
    const userRole = manager.create(UserRole, { userId, roleId });
    await manager.save(UserRole, userRole);
  });

  return this.getRoles(userId);
}

  /**
   * Activates or deactivates a team member. Same hierarchy as changing a role:
   * SUPER_ADMIN can manage everyone, others only the roles in ROLE_ASSIGNMENT_MAP.
   * Deactivating also signs the person out everywhere.
   */
  async setStatus(
    userId: string,
    status: UserStatus.ACTIVE | UserStatus.INACTIVE,
    requesterId: string,
    requesterRoles: string[],
  ) {
    if (userId === requesterId) {
      throw new ForbiddenException('You cannot change your own account status');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentRoles = await this.getRoles(userId);
    const currentNames = currentRoles.map((ur) => ur.role.name);

    if (!requesterRoles.includes('SUPER_ADMIN')) {
      const allowedTargets = requesterRoles.flatMap(
        (r) => ROLE_ASSIGNMENT_MAP[r] ?? [],
      );
      if (!currentNames.every((name) => allowedTargets.includes(name))) {
        throw new ForbiddenException(
          "You are not allowed to manage this user's account",
        );
      }
    }

    if (user.status === status) {
      return { id: user.id, status: user.status };
    }

    // Never lock everyone out: keep at least one active Super Admin.
    if (status === UserStatus.INACTIVE && currentNames.includes('SUPER_ADMIN')) {
      const otherActive = await this.userRepository
        .createQueryBuilder('u')
        .innerJoin('u.userRoles', 'ur')
        .innerJoin('ur.role', 'r')
        .where('r.name = :name', { name: 'SUPER_ADMIN' })
        .andWhere('u.status = :active', { active: UserStatus.ACTIVE })
        .andWhere('u.id != :id', { id: userId })
        .getCount();
      if (otherActive === 0) {
        throw new BadRequestException(
          'At least one active Super Admin is required',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, userId, { status });
      if (status === UserStatus.INACTIVE) {
        await manager.update(
          Session,
          { userId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      }
    });

    return { id: userId, status };
  }

  /** A signed-in person edits their own name, email and phone. */
  async updateMe(userId: string, dto: UpdateMyProfileDto) {
    const profile = await this.userProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    if (dto.fullName !== undefined) {
      const parts = dto.fullName.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
        throw new BadRequestException('Name cannot be empty');
      }
      profile.firstName = parts[0];
      profile.lastName = parts.slice(1).join(' ');
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== profile.email.toLowerCase()) {
        const taken = await this.userProfileRepository
          .createQueryBuilder('p')
          .where('LOWER(p.email) = :email', { email })
          .andWhere('p.userId <> :userId', { userId })
          .getOne();
        if (taken) {
          throw new ConflictException('This email is already used by someone else');
        }
        profile.email = email;
      }
    }

    if (dto.phone !== undefined) {
      profile.phone = dto.phone.trim() || null;
    }

    await this.userProfileRepository.save(profile);
    return this.getMe(userId);
  }

  /** Sets (or replaces) the profile photo with an already uploaded image URL. */
  async updateMyAvatar(userId: string, imageUrl: string) {
    const profile = await this.userProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    const previous = profile.avatar;
    profile.avatar = imageUrl;
    await this.userProfileRepository.save(profile);
    if (previous && previous !== imageUrl) {
      try {
        await deleteCloudinaryImage(previous);
      } catch {
        // The old file is just clutter; the new photo is already saved.
      }
    }
    return this.getMe(userId);
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
