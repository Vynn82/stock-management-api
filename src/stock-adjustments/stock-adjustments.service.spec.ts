import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustment } from './entities/stock-adjustment.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';

describe('StockAdjustmentsService', () => {
  let service: StockAdjustmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockAdjustmentsService,
        {
          provide: getRepositoryToken(StockAdjustment),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Stock),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Warehouse),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StockAdjustmentsService>(StockAdjustmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
