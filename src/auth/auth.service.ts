import { Injectable, UnauthorizedException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { User, UserStatus } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';

import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,

    private readonly jwtService: JwtService,

    private readonly sessionsService: SessionsService,
  ) {}

  // =====================================================
  // LOGIN
  // =====================================================

  async login(loginDto: LoginDto) {
    const { staffId, password } = loginDto;

    // 1. Find user
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.staffId = :staffId', { staffId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid staff ID or password');
    }

    // 2. Check account status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    // 3. Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid staff ID or password');
    }

    // 4. Get user's roles
    const userRoles = await this.userRoleRepository.find({
      where: {
        userId: user.id,
      },
      relations: {
        role: true,
      },
    });

    const roles = userRoles.map((userRole) => userRole.role.name);

    // 5. Generate access token
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      staffId: user.staffId,
      roles,
    });

    // 6. Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // 7. Refresh token expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 8. Create session
    await this.sessionsService.createSession(user.id, refreshToken, expiresAt);

    // 9. Update last login
    user.lastLoginAt = new Date();

    await this.userRepository.save(user);

    // 10. Return tokens
    return {
      accessToken,
      refreshToken,
      mustChangePassword: user.mustChangePassword,
    };
  }

  // =====================================================
  // REFRESH TOKEN
  // =====================================================

  async refresh(refreshToken: string) {
    // 1. Validate refresh token
    const session = await this.sessionsService.findValidSession(refreshToken);

    // 2. Find current user
    const user = await this.userRepository.findOne({
      where: {
        id: session.userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 3. Check account status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    // 4. Load CURRENT roles
    const userRoles = await this.userRoleRepository.find({
      where: {
        userId: user.id,
      },
      relations: {
        role: true,
      },
    });

    const roles = userRoles.map((userRole) => userRole.role.name);

    // 5. Revoke old refresh session
    await this.sessionsService.revokeSession(session.id);

    // 6. Generate new access token
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      staffId: user.staffId,
      roles,
    });

    // 7. Generate new refresh token
    const newRefreshToken = crypto.randomBytes(64).toString('hex');

    // 8. Refresh token expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 9. Create new session
    await this.sessionsService.createSession(
      user.id,
      newRefreshToken,
      expiresAt,
    );

    // 10. Return new tokens
    return {
      accessToken,
      refreshToken: newRefreshToken,
      mustChangePassword: user.mustChangePassword,
    };
  }
  // =====================================================
  // CHANGE PASSWORD
  // =====================================================

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    // 1. Get user
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 2. Verify current password
    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // 3. Make sure new password is different
    const samePassword = await bcrypt.compare(newPassword, user.passwordHash);

    if (samePassword) {
      throw new UnauthorizedException(
        'New password must be different from current password',
      );
    }

    // 4. Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // 5. Update
    user.passwordHash = newPasswordHash;

    user.mustChangePassword = false;

    await this.userRepository.save(user);

    return {
      message: 'Password changed successfully',
    };
  }
}
