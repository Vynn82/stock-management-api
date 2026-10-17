import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { RequirePermission } from '../auth/decorators/permission.decorator';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @RequirePermission('STOCK_ADJUST')
  @Post()
  create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @RequirePermission('STOCK_VIEW')
  @Get()
  findAll() {
    return this.stockService.findAll();
  }

  @RequirePermission('STOCK_VIEW')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(+id);
  }

  @RequirePermission('STOCK_ADJUST')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(+id, updateStockDto);
  }

  @RequirePermission('STOCK_ADJUST')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockService.remove(+id);
  }
}
