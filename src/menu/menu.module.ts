import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { Menu } from './menu.entity';
import { MenuService } from './menu.service';
import { MenusController } from './menu.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Menu])],

  controllers: [MenusController],

  providers: [MenuService],

  exports: [MenuService],
})
export class MenusModule {}
