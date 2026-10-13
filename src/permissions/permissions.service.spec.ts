import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PermissionsService } from './permissions.service';
import { Permission } from './permission.entity';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(Permission),
          useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn(), createQueryRunner: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
