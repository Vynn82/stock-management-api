import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestsService } from './requests.service';
import { Request } from './entities/request.entity';
import { User } from '../users/entities/user.entity';
import { MailsService } from '../mails/mails.service';
import { RequestsExcelService } from './requests-excel.service';
import { RequestImportTemplateService } from './request-import-template.service';
import { BarcodesService } from '../barcodes/barcodes.service';

describe('RequestsService', () => {
  let service: RequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(Request),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: MailsService,
          useValue: { sendMail: jest.fn() },
        },
        {
          provide: RequestsExcelService,
          useValue: { importExcel: jest.fn() },
        },
        {
          provide: RequestImportTemplateService,
          useValue: { generateTemplate: jest.fn() },
        },
        {
          provide: BarcodesService,
          useValue: { lookupByBarcode: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn(), createQueryRunner: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
