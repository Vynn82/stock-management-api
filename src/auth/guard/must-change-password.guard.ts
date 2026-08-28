// import {
//   CanActivate,
//   ExecutionContext,
//   ForbiddenException,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
//
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
//
// import { User } from '../../users/entities/user.entity';
//
// @Injectable()
// export class MustChangePasswordGuard implements CanActivate {
//   constructor(
//     @InjectRepository(User)
//     private readonly userRepository: Repository<User>,
//   ) {}
//
//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest();
//
//     const userId = request.user?.sub;
//
//     if (!userId) {
//       throw new UnauthorizedException('User not authenticated');
//     }
//
//     const user = await this.userRepository.findOne({
//       where: {
//         id: userId,
//       },
//     });
//
//     if (!user) {
//       throw new UnauthorizedException('User not found');
//     }
//
//     if (user.mustChangePassword) {
//       throw new ForbiddenException(
//         'You must change your password before continuing',
//       );
//     }
//
//     return true;
//   }
// }
//
//
// import {
//   CanActivate,
//   ExecutionContext,
//   ForbiddenException,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
//
// import { Reflector } from '@nestjs/core';
//
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
//
// import { User } from '../../users/entities/user.entity';
// import { ALLOW_PASSWORD_CHANGE } from '../decorators/allow-password-change.decorator';
//
// @Injectable()
// export class MustChangePasswordGuard implements CanActivate {
//   constructor(
//     private readonly reflector: Reflector,
//
//     @InjectRepository(User)
//     private readonly userRepository: Repository<User>,
//   ) {}
//
//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     // Check whether this endpoint is explicitly allowed
//     // when mustChangePassword = true
//     const allowed = this.reflector.getAllAndOverride<boolean>(
//       ALLOW_PASSWORD_CHANGE,
//       [context.getHandler(), context.getClass()],
//     );
//
//     if (allowed) {
//       return true;
//     }
//
//     const request = context.switchToHttp().getRequest();
//
//     const userId = request.user?.sub;
//
//     if (!userId) {
//       throw new UnauthorizedException('User not authenticated');
//     }
//
//     const user = await this.userRepository.findOne({
//       where: {
//         id: userId,
//       },
//     });
//
//     if (!user) {
//       throw new UnauthorizedException('User not found');
//     }
//
//     if (user.mustChangePassword) {
//       throw new ForbiddenException(
//         'You must change your password before continuing',
//       );
//     }
//
//     return true;
//   }
// }
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';

import { ALLOW_PASSWORD_CHANGE } from '../decorators/allow-password-change.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ==========================================
    // 1. PUBLIC ROUTE?
    // ==========================================

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ==========================================
    // 2. ALLOWED DURING PASSWORD CHANGE?
    // ==========================================

    const allowPasswordChange = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE,
      [context.getHandler(), context.getClass()],
    );

    if (allowPasswordChange) {
      return true;
    }

    // ==========================================
    // 3. GET AUTHENTICATED USER
    // ==========================================

    const request = context.switchToHttp().getRequest();

    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // ==========================================
    // 4. LOAD USER
    // ==========================================

    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // ==========================================
    // 5. CHECK PASSWORD STATUS
    // ==========================================

    if (user.mustChangePassword) {
      throw new ForbiddenException(
        'You must change your password before continuing',
      );
    }

    return true;
  }
}
