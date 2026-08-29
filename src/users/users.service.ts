import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
  ) {}

  async findAll() {
    return this.userRepository.find({
      relations: {
        profile: true,
        userRoles: {
          role: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
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

    // 2. Get next staff number
    const result = await this.dataSource.query(`
      SELECT nextval('staff_id_seq') AS number
    `);

    const number = Number(result[0].number);

    //  Generate staff ID
    const staffId = `KH${number.toString().padStart(5, '0')}`;

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();

    // Hash password
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    // avatar

    //  Save User + Profile
    await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        staffId,
        passwordHash,
      });

      const savedUser = await manager.save(User, user);
      // generate avatar
      const avatarUrl = this.generateAvatar(firstName, lastName);

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
    });
    // send maill
    await this.mailService.sendWelcomeEmail(
      email,
      firstName,
      lastName,
      staffId,
      temporaryPassword,
    );
    // 7. Temporary response for testing
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
  async updateRoles(userId: string, roleIds: string[]) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove duplicate role IDs
    roleIds = [...new Set(roleIds)];

    // Verify roles exist
    if (roleIds.length > 0) {
      const roles = await this.roleRepository.find({
        where: {
          id: In(roleIds),
        },
      });

      if (roles.length !== roleIds.length) {
        throw new BadRequestException('One or more roles do not exist');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      // Remove existing roles
      await manager.delete(UserRole, {
        userId,
      });

      // Add new roles
      if (roleIds.length > 0) {
        const userRoles = roleIds.map((roleId) =>
          manager.create(UserRole, {
            userId,
            roleId,
          }),
        );

        await manager.save(UserRole, userRoles);
      }
    });

    return this.getRoles(userId);
  }
  /// helper method
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
