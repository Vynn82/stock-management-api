import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import * as authenticatedUserInterface from '../auth/interfaces/authenticated-request.interface';

import type { Response } from 'express';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';

import { RequestsExcelService } from './requests-excel.service';
import { RequestImportTemplateService } from './request-import-template.service';
import { RequestsService } from './requests.service';

import { RequestType } from './enum/request-type.enum';
import { RequestSource } from './enum/request-source.enum';

import { CreateRequestDto } from './dto/create-request.dto';

import { Public } from '../auth/decorators/public.decorator';
import { productStorage } from '../common/cloudinary/cloudinary-storage';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { CommitRequestDto } from './dto/commit-request.dto';
import { PaginationDto } from '../common/pagination';

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsExcelService: RequestsExcelService,

    private readonly requestImportTemplateService: RequestImportTemplateService,

    private readonly requestsService: RequestsService,
  ) {}

  @Get()
  findAll(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Query() query: PaginationDto,
  ) {
    return this.requestsService.findAll(req.user.sub, query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.findOne(id, req.user.sub);
  }

  // =====================================================
  // DOWNLOAD EXCEL TEMPLATE
  // =====================================================

  @Public()
  @Get('import/template')
  generateTemplate(
    @Query('type') requestType: RequestType,
    @Res() res: Response,
  ) {
    const file =
      this.requestImportTemplateService.generateTemplate(requestType);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      'Content-Disposition': `attachment; filename="${requestType}.xlsx"`,

      'Content-Length': file.length,
    });

    res.send(file);
  }

  // =====================================================
  // MANUAL CREATE
  // =====================================================

  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: productStorage,
    }),
  )
  create(
    @Body() body: any,

    @UploadedFiles()
    files: Express.Multer.File[],

    @Req()
    req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    const parseJson = (val: any) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    const createRequestDto: CreateRequestDto = {
      requestType: body.requestType ?? body.type,

      product: body.product ? parseJson(body.product) : undefined,

      variants: body.variants ? parseJson(body.variants) : undefined,

      stock: body.stock ? parseJson(body.stock) : undefined,

      adjustments: body.adjustments ? parseJson(body.adjustments) : undefined,

      approvers: body.approvers ? parseJson(body.approvers) : [],

      remark: body.remark ?? null,
    };

    // Product image
    let productImageUrl: string | undefined;

    // Variant images
    const variantImageUrls: Record<string, string> = {};

    for (const file of files ?? []) {
      // Product image
      if (file.fieldname === 'image') {
        productImageUrl = file.path;
        continue;
      }

      // Variant image
      const match = file.fieldname.match(/^variantImage\[(.+)\]$/);

      if (match) {
        const variantCode = match[1];

        variantImageUrls[variantCode] = file.path;
      }
    }

    return this.requestsService.create(
      createRequestDto,
      req.user.sub,
      RequestSource.MANUAL,
      productImageUrl,
      variantImageUrls,
    );
  }

  // =====================================================
  // EXCEL IMPORT
  // =====================================================

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(
    @UploadedFile()
    file: Express.Multer.File,

    @Body('requestType')
    requestType: RequestType,

    @Body('approvers')
    approversRaw: any,

    @Req()
    req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    // ---------------------------------------------
    // Excel → CreateRequestDto
    // ---------------------------------------------

    const dto = this.requestsExcelService.importExcel(file, requestType);

    if (approversRaw) {
      try {
        dto.approvers =
          typeof approversRaw === 'string'
            ? JSON.parse(approversRaw)
            : approversRaw;
      } catch {}
    }

    // ---------------------------------------------
    // Create request using SAME business logic
    // ---------------------------------------------

    return this.requestsService.create(dto, req.user.sub, RequestSource.EXCEL);
  }

  @Post(':id/commit')
  commit(
    @Param('id') requestId: string,
    @Body() dto: CommitRequestDto,
    @Req()
    req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.commit(requestId, req.user.sub, dto);
  }
}
