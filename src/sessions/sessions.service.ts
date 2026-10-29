import { Injectable, UnauthorizedException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as crypto from 'crypto';

import { Session } from './entities/session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createSession(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const refreshTokenHash = this.hashToken(refreshToken);

    const session = this.sessionRepository.create({
      userId,
      refreshTokenHash,
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    });

    return this.sessionRepository.save(session);
  }

  async findValidSession(refreshToken: string) {
    const refreshTokenHash = this.hashToken(refreshToken);

    const session = await this.sessionRepository.findOne({
      where: {
        refreshTokenHash,
        revokedAt: IsNull(),
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    return session;
  }

  async revokeSession(sessionId: string) {
    await this.sessionRepository.update(sessionId, {
      revokedAt: new Date(),
    });
  }

  /** Signs the user out everywhere (used after a password reset). */
  async revokeAllForUser(userId: string) {
    await this.sessionRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
