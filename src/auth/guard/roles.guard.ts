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

import { UserRole } from '../../users/entities/user-role.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userRoles = await this.userRoleRepository.find({
      where: {
        userId,
      },
      relations: {
        role: true,
      },
    });

    const userRoleNames = userRoles.map((ur) => ur.role.name);

    // SUPER_ADMIN always has access
    if (userRoleNames.includes('SUPER_ADMIN')) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => userRoleNames.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
