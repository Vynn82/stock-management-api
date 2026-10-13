import { Test, TestingModule } from '@nestjs/testing';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

import { RequestsExcelService } from './requests-excel.service';
import { RequestImportTemplateService } from './request-import-template.service';

describe('RequestsController', () => {
  let controller: RequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        {
          provide: RequestsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            commit: jest.fn(),
          },
        },
        {
          provide: RequestsExcelService,
          useValue: {
            exportRequests: jest.fn(),
          },
        },
        {
          provide: RequestImportTemplateService,
          useValue: {
            downloadTemplate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RequestsController>(RequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
