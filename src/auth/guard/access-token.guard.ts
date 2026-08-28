// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
//
// import { JwtService } from '@nestjs/jwt';
// import { Request } from 'express';
//
// @Injectable()
// export class AccessTokenGuard implements CanActivate {
//   constructor(private readonly jwtService: JwtService) {}
//
//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest<Request>();
//
//     const authorization = request.headers.authorization;
//
//     if (!authorization) {
//       throw new UnauthorizedException('Access token required');
//     }
//
//     const [type, token] = authorization.split(' ');
//
//     if (type !== 'Bearer' || !token) {
//       throw new UnauthorizedException('Invalid authorization header');
//     }
//
//     try {
//       const payload = await this.jwtService.verifyAsync(token);
//
//       request['user'] = payload;
//
//       return true;
//     } catch {
//       throw new UnauthorizedException('Invalid or expired access token');
//     }
//   }
// }

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Access token required');
    }

    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      request['user'] = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}