import { Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';

import { MailsService } from './mails.service';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';
import { PaginationDto } from '../common/pagination';

@Controller('mails')
export class MailsController {
  constructor(private readonly mailsService: MailsService) {}

  @Get()
  async findMyMails(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Query() query: PaginationDto,
  ) {
    return this.mailsService.findByUser(req.user.sub, query);
  }

  @Get('unread-count')
  async getUnreadCount(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.mailsService.getUnreadCount(req.user.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.mailsService.markAsRead(id, req.user.sub);
  }
}
