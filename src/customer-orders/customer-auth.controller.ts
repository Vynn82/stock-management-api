import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TelegramAuthService } from './telegram/telegram-auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { CustomerRegisterDto } from './dto/customer-registration.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller(['customer-auth', 'customer-orders/auth'])
export class CustomerAuthController {
  constructor(private readonly telegramAuthService: TelegramAuthService) {}

  @Public()
  @Post('telegram')
  async authenticateTelegram(@Body() dto: TelegramAuthDto) {
    return this.telegramAuthService.authenticateTelegramCustomer(dto.initData);
  }

  @Public()
  @Post('register')
  async registerCustomer(@Body() dto: CustomerRegisterDto) {
    return this.telegramAuthService.registerCustomer(dto);
  }

  @Public()
  @Get('location/reverse-geocode')
  async reverseGeocode(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ) {
    return this.telegramAuthService.reverseGeocode(Number(lat), Number(lng));
  }

  @Public()
  @Get('location/search')
  async searchLocation(@Query('query') query: string) {
    return this.telegramAuthService.searchLocation(query);
  }
}
