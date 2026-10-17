import { Test, TestingModule } from '@nestjs/testing';
import { ProductVariantsController } from './product-variants.controller';
import { ProductVariantsService } from './product-variants.service';
import { BarcodesService } from '../barcodes/barcodes.service';

describe('ProductVariantsController', () => {
  let controller: ProductVariantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductVariantsController],
      providers: [
        {
          provide: ProductVariantsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: BarcodesService,
          useValue: {
            lookupByBarcode: jest.fn(),
            streamVariantBarcode: jest.fn(),
            streamVariantQr: jest.fn(),
            streamVariantLabel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProductVariantsController>(
      ProductVariantsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
