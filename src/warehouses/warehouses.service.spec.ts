import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WarehousesService } from './warehouses.service';
import { Warehouse } from './entities/warehouse.entity';

describe('WarehousesService', () => {
  let service: WarehousesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: getRepositoryToken(Warehouse),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
