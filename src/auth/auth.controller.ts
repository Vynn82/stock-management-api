import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AccessTokenGuard } from './guard/access-token.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AllowPasswordChange } from './decorators/allow-password-change.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';
import * as authenticatedUserInterface from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AccessTokenGuard)
  @AllowPasswordChange()
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, dto);
  }

  @Public()
  @AllowPasswordChange()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
