import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Patch,
  Param,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Mail } from './entities/mail.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

@Injectable()
export class MailsService {
  constructor(
    @InjectRepository(Mail)
    private readonly mailRepository: Repository<Mail>,
  ) {}

  async createMail(params: {
    recipientId: string;
    requestId: string;
    requestType: string;
    subject: string;
    message: string;
    action: string;
    requestUrl: string;
  }) {
    const mail = this.mailRepository.create({
      recipientId: params.recipientId,
      requestId: params.requestId,
      requestType: params.requestType,
      subject: params.subject,
      message: params.message,
      action: params.action,
      requestUrl: params.requestUrl,
      isRead: false,
    });

    return this.mailRepository.save(mail);
  }

  async findByUser(userId: string, paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.mailRepository
      .createQueryBuilder('mail')
      .where('mail.recipientId = :userId', { userId });

    if (search) {
      queryBuilder.andWhere(
        '(mail.subject ILIKE :search OR mail.message ILIKE :search OR mail.action ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('mail.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [mails, total] = await queryBuilder.getManyAndCount();

    return createPaginatedResult(mails, total, paginationDto);
  }

  async getUnreadCount(userId: string) {
    return this.mailRepository.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });
  }

  async markAsRead(mailId: string, userId: string) {
    const mail = await this.mailRepository.findOne({
      where: {
        id: mailId,
      },
    });

    if (!mail) {
      throw new NotFoundException('Mail not found');
    }

    if (mail.recipientId !== userId) {
      throw new ForbiddenException('You cannot access this mail');
    }

    mail.isRead = true;

    return this.mailRepository.save(mail);
  }
}
