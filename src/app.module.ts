// import { Module } from '@nestjs/common';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { TypeOrmModule } from '@nestjs/typeorm';
//
// import { UsersModule } from './users/users.module';
// import { RolesModule } from './roles/roles.module';
// import { PermissionsModule } from './permissions/permissions.module';
// import { MailModule } from './mail/mail.module';
// import { SessionsModule } from './sessions/sessions.module';
// import { AuthModule } from './auth/auth.module';
// import { User } from './users/entities/user.entity';
//
// @Module({
//   imports: [
//     ConfigModule.forRoot({
//       isGlobal: true,
//     }),
//
//     TypeOrmModule.forRootAsync({
//       inject: [ConfigService],
//
//       useFactory: (configService: ConfigService) => ({
//         // type: 'postgres',
//         //
//         // host: configService.get<string>('DB_HOST'),
//         //
//         // port: Number(configService.get<string>('DB_PORT')),
//         //
//         // username: configService.get<string>('DB_USERNAME'),
//         //
//         // password: configService.get<string>('DB_PASSWORD'),
//         //
//         // database: configService.get<string>('DB_DATABASE'),
//         type: 'postgres',
//         url: configService.get<string>('DATABASE_URL'),
//         ssl: {
//           rejectUnauthorized: false, // Required for Neon and cloud Postgres SSL
//         },
//
//         autoLoadEntities: true,
//
//         synchronize: false,
//       }),
//     }),
//     TypeOrmModule.forFeature([User]),
//
//     UsersModule,
//
//     RolesModule,
//
//     PermissionsModule,
//
//     MailModule,
//
//     SessionsModule,
//
//     AuthModule,
//   ],
// })
// export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { MailModule } from './mail/mail.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        console.log(
          'Connecting to Database:',
          dbUrl ? 'URL Loaded' : 'MISSING (Check .env)',
        );

        return {
          type: 'postgres',
          url: dbUrl,
          ssl: {
            rejectUnauthorized: false, // Required for Neon cloud SSL
          },
          autoLoadEntities: true,
          synchronize: true, // Set to TRUE to create tables automatically in Neon
        };
      },
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
