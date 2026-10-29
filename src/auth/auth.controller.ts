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
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyResetOtpDto,
} from './dto/password-reset.dto';
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

  // ---- Forgot password (all public: the user can't sign in) ----

  /** Step 1 — emails a 6-digit code to the account's email address. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.staffId);
  }

  /** Step 2 — checks the code; returns a one-time `resetToken`. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-reset-otp')
  verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto.staffId, dto.otp);
  }

  /** Step 3 — sets the new password using the `resetToken`. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
