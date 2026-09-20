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

import { PERMISSIONS_KEY } from '../decorators/permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ==========================================
    // 1. Get required permissions
    // ==========================================

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermission()
    // means no permission restriction
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // ==========================================
    // 2. Get authenticated user
    // ==========================================

    const request = context.switchToHttp().getRequest();

    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // ==========================================
    // 3. Get user's roles
    // ==========================================

    const userRoles = await this.userRoleRepository.find({
      where: {
        userId,
      },
      relations: {
        role: {
          rolePermissions: {
            permission: true,
          },
        },
      },
    });

    // ==========================================
    // 4. SUPER_ADMIN bypass
    // ==========================================

    const isSuperAdmin = userRoles.some(
      (userRole) => userRole.role.name === 'SUPER_ADMIN',
    );

    if (isSuperAdmin) {
      return true;
    }

    // ==========================================
    // 5. Extract permissions
    // ==========================================

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissions.add(rolePermission.permission.name);
      }
    }

    // ==========================================
    // 6. Check permissions
    // ==========================================

    const hasPermission = requiredPermissions.every((permission) =>
      permissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
