import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';

import { SessionsModule } from '../sessions/sessions.module';

import { AccessTokenGuard } from './guard/access-token.guard';
import { MustChangePasswordGuard } from './guard/must-change-password.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),

        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),

    SessionsModule,
  ],

  controllers: [AuthController],

  providers: [
    AuthService,

    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },

    {
      provide: APP_GUARD,
      useClass: MustChangePasswordGuard,
    },
  ],
})
export class AuthModule {}
