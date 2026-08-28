import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { MailModule } from './mail/mail.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { MustChangePasswordGuard } from './auth/guard/must-change-password.guard';
import { User } from './users/entities/user.entity';
import { AccessTokenGuard } from './auth/guard/access-token.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        type: 'postgres',

        host: configService.get<string>('DB_HOST'),

        port: Number(configService.get<string>('DB_PORT')),

        username: configService.get<string>('DB_USERNAME'),

        password: configService.get<string>('DB_PASSWORD'),

        database: configService.get<string>('DB_DATABASE'),

        autoLoadEntities: true,

        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([User]),

    UsersModule,

    RolesModule,

    PermissionsModule,

    MailModule,

    SessionsModule,

    AuthModule,
  ],
})
export class AppModule {}
