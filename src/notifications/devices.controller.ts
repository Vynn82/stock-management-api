import { Body, Controller, Post, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/register-device.dto';

/** Staff phones register their FCM token here after login. */
@Controller('devices')
export class DevicesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  register(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    return this.notifications.register(req.user.sub, dto.token, dto.platform);
  }

  /** Sends a test push to the signed-in user's own phones and reports the result. */
  @Post('test')
  test(@Req() req: any) {
    return this.notifications.sendTest(req.user.sub);
  }

  /** POST (not DELETE) so the mobile client can send the token in the body. */
  @Post('unregister')
  unregister(@Req() req: any, @Body() dto: UnregisterDeviceDto) {
    return this.notifications.unregister(req.user.sub, dto.token);
  }
}
