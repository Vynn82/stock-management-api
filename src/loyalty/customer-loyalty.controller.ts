import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { CustomerJwtGuard } from '../customer-orders/guards/customer-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller(['loyalty/my-profile', 'customer-orders/loyalty/profile'])
export class CustomerLoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get()
  async getMyProfile(@Req() req: any) {
    return this.loyaltyService.calculateCustomerLoyalty(req.customer?.id || req.customer?.sub);
  }
}

