import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RequestsExcelService } from './requests-excel.service';
import { RequestImportTemplateService } from './request-import-template.service';

import { Request } from './entities/request.entity';
import { RequestItem } from './entities/request-item.entity';
import { Approver } from './entities/approver.entity';
import { User } from '../users/entities/user.entity';
import { MailsService } from '../mails/mails.service';
import { Mail } from '../mails/entities/mail.entity';
import { Stock } from '../stock/entities/stock.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import { BarcodesModule } from '../barcodes/barcodes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Request,
      RequestItem,
      Approver,
      User,
      Mail,
      Stock,
      StockAdjustment,
    ]),
    BarcodesModule,
  ],

  controllers: [RequestsController],

  providers: [
    RequestsService,
    RequestsExcelService,
    RequestImportTemplateService,
    MailsService,
  ],
  exports: [RequestsService],
})
export class RequestsModule {}
