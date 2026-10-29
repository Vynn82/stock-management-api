import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { User, UserStatus } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';

import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { PasswordReset } from './entities/password-reset.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,

    private readonly jwtService: JwtService,

    private readonly sessionsService: SessionsService,

    private readonly usersService: UsersService,

    private readonly mailService: MailService,

    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
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

    // 10. Get full user details (profile, roles, permissions, menus)
    const userDetails = await this.usersService.getMe(user.id);

    // 11. Return tokens and user
    return {
      accessToken,
      refreshToken,
      mustChangePassword: user.mustChangePassword,
      user: userDetails,
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

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const samePassword = await bcrypt.compare(newPassword, user.passwordHash);

    if (samePassword) {
      throw new UnauthorizedException(
        'New password must be different from current password',
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;

    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      mustChangePassword: false,
    };
  }
  async changePasswordOLD(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ) {
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
  private async generateTokens(user: User) {
    const userRoles = await this.userRoleRepository.find({
      where: {
        userId: user.id,
      },
      relations: {
        role: true,
      },
    });

    const roles = userRoles.map((userRole) => userRole.role.name);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      staffId: user.staffId,
      roles,
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.sessionsService.createSession(user.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
    };
  }

  // =====================================================
  // FORGOT PASSWORD (email code)
  // =====================================================

  private static readonly RESET_TTL_MS = 10 * 60 * 1000; // code + token life
  private static readonly RESET_RESEND_MS = 60 * 1000; // min gap between emails
  private static readonly RESET_MAX_ATTEMPTS = 5; // wrong codes allowed

  private hashSecret(value: string): string {
    return crypto
      .createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '')
      .update(value)
      .digest('hex');
  }

  /**
   * Emails a 6-digit code. The answer is always the same generic message so
   * the endpoint can't be used to find out which Staff IDs exist.
   */
  async forgotPassword(staffId: string) {
    const generic = {
      message:
        'If the Staff ID exists, a verification code has been sent to its email address.',
    };

    const user = await this.userRepository.findOne({
      where: { staffId: staffId.trim() },
      relations: { profile: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE || !user.profile?.email) {
      return generic;
    }

    // Too soon after the previous email: quietly do nothing.
    const latest = await this.passwordResetRepository.findOne({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < AuthService.RESET_RESEND_MS
    ) {
      return generic;
    }

    // Only the newest code works.
    await this.passwordResetRepository.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

    const reset = await this.passwordResetRepository.save(
      this.passwordResetRepository.create({
        userId: user.id,
        otpHash: this.hashSecret(`${user.id}:${otp}`),
        resetTokenHash: null,
        attempts: 0,
        expiresAt: new Date(Date.now() + AuthService.RESET_TTL_MS),
        verifiedAt: null,
        usedAt: null,
      }),
    );

    try {
      await this.mailService.sendPasswordResetOtp(
        user.profile.email,
        user.profile.firstName,
        otp,
        AuthService.RESET_TTL_MS / 60000,
      );
    } catch {
      await this.passwordResetRepository.update(reset.id, {
        usedAt: new Date(),
      });
      throw new ServiceUnavailableException(
        'Could not send the verification email. Please try again later.',
      );
    }

    return generic;
  }

  /** Checks the emailed code and hands back a one-time reset token. */
  async verifyResetOtp(staffId: string, otp: string) {
    const invalid = () =>
      new BadRequestException('Invalid or expired verification code');

    const user = await this.userRepository.findOne({
      where: { staffId: staffId.trim() },
    });
    if (!user) throw invalid();

    const reset = await this.passwordResetRepository.findOne({
      where: { userId: user.id, usedAt: IsNull(), verifiedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!reset || reset.expiresAt.getTime() <= Date.now()) throw invalid();

    if (reset.attempts >= AuthService.RESET_MAX_ATTEMPTS) {
      await this.passwordResetRepository.update(reset.id, {
        usedAt: new Date(),
      });
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    const expected = Buffer.from(reset.otpHash, 'hex');
    const actual = Buffer.from(this.hashSecret(`${user.id}:${otp}`), 'hex');
    const matches =
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      const attempts = reset.attempts + 1;
      const locked = attempts >= AuthService.RESET_MAX_ATTEMPTS;
      await this.passwordResetRepository.update(reset.id, {
        attempts,
        ...(locked ? { usedAt: new Date() } : {}),
      });
      throw new BadRequestException(
        locked
          ? 'Too many incorrect attempts. Please request a new code.'
          : `Incorrect code. ${AuthService.RESET_MAX_ATTEMPTS - attempts} attempt(s) left.`,
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    await this.passwordResetRepository.update(reset.id, {
      verifiedAt: new Date(),
      resetTokenHash: this.hashSecret(resetToken),
      expiresAt: new Date(Date.now() + AuthService.RESET_TTL_MS),
    });

    return { resetToken };
  }

  /** Sets the new password, then signs the user out of every device. */
  async resetPassword(resetToken: string, newPassword: string) {
    const expired = () =>
      new BadRequestException('Reset session expired. Please start again.');

    const reset = await this.passwordResetRepository.findOne({
      where: { resetTokenHash: this.hashSecret(resetToken), usedAt: IsNull() },
    });

    if (!reset || !reset.verifiedAt || reset.expiresAt.getTime() <= Date.now()) {
      throw expired();
    }

    const user = await this.userRepository.findOne({
      where: { id: reset.userId },
    });
    if (!user || user.status !== UserStatus.ACTIVE) throw expired();

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await this.userRepository.save(user);

    await this.passwordResetRepository.update(reset.id, {
      usedAt: new Date(),
    });

    await this.sessionsService.revokeAllForUser(user.id);

    return { message: 'Password has been reset successfully' };
  }
}
