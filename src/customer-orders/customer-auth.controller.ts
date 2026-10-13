import { Body, Controller, Post } from '@nestjs/common';
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
}
