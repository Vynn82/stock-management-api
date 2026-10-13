import { Test, TestingModule } from '@nestjs/testing';
import { MailsController } from './mails.controller';
import { MailsService } from './mails.service';

describe('MailsController', () => {
  let controller: MailsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MailsController],
      providers: [
        {
          provide: MailsService,
          useValue: {
            findByUser: jest.fn(),
            getUnreadCount: jest.fn(),
            markAsRead: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MailsController>(MailsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
