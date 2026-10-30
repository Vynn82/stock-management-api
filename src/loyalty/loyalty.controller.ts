import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { CreateLoyaltyTierDto, UpdateLoyaltyTierDto } from './dto/loyalty-tier.dto';
import { UpdateLoyaltyConfigDto } from './dto/loyalty-config.dto';
import { OverrideCustomerTierDto } from './dto/customer-loyalty-override.dto';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // =========================================================================
  // 1. BUSINESS CONFIGURATION
  // =========================================================================

  @Get('config')
  async getConfig() {
    return this.loyaltyService.getOrCreateConfig();
  }

  @Put('config')
  async updateConfig(@Body() dto: UpdateLoyaltyConfigDto) {
    return this.loyaltyService.updateConfig(dto);
  }

  // =========================================================================
  // 2. LOYALTY TIERS
  // =========================================================================

  @Get('tiers')
  async getAllTiers(@Query('includeInactive') includeInactive?: string) {
    return this.loyaltyService.getAllTiers(includeInactive === 'true');
  }

  @Get('tiers/:id')
  async getTierById(@Param('id') id: string) {
    return this.loyaltyService.getTierById(id);
  }

  @Post('tiers')
  async createTier(@Body() dto: CreateLoyaltyTierDto) {
    return this.loyaltyService.createTier(dto);
  }

  @Put('tiers/:id')
  async updateTier(
    @Param('id') id: string,
    @Body() dto: UpdateLoyaltyTierDto,
  ) {
    return this.loyaltyService.updateTier(id, dto);
  }

  @Delete('tiers/:id')
  async deleteTier(@Param('id') id: string) {
    return this.loyaltyService.deleteTier(id);
  }

  // =========================================================================
  // 3. CUSTOMER LOYALTY PROFILES & ADMIN OVERRIDE
  // =========================================================================

  @Get('customers/:id')
  async getCustomerLoyaltyProfile(@Param('id') customerId: string) {
    return this.loyaltyService.calculateCustomerLoyalty(customerId);
  }

  @Post('customers/:id/override-tier')
  async overrideTier(
    @Param('id') customerId: string,
    @Body() dto: OverrideCustomerTierDto,
  ) {
    return this.loyaltyService.overrideCustomerTier(customerId, dto);
  }

  @Post('recalculate-all')
  async recalculateAll() {
    return this.loyaltyService.recalculateAllCustomers();
  }
}

