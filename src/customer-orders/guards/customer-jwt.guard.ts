import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Customer } from '../entities/customer.entity';
import { CustomerStatus } from '../enums/customer-status.enum';

export interface CustomerJwtPayload {
  sub: string;
  telegramAccountId?: string;
  telegramUserId: string;
  firstName?: string;
  role: string;
}

@Injectable()
export class CustomerJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Customer access token required');
    }

    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization token format');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<CustomerJwtPayload>(token);

      if (payload.role !== 'CUSTOMER') {
        throw new ForbiddenException(
          'Access denied: Customer credentials required',
        );
      }

      // Verify customer exists and is ACTIVE
      const customer = await this.customerRepo.findOne({
        where: { id: payload.sub },
      });

      if (!customer) {
        throw new UnauthorizedException('Customer account not found');
      }

      if (customer.status !== CustomerStatus.ACTIVE) {
        throw new ForbiddenException(
          `Customer account is not active. Current status: ${customer.status}`,
        );
      }

      request['customer'] = {
        id: customer.id,
        telegramUserId: payload.telegramUserId,
        telegramAccountId: payload.telegramAccountId,
        companyName: customer.companyName,
        contactName: customer.contactName,
        status: customer.status,
      };

      return true;
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired customer token');
    }
  }
}
