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

import { RequestsService } from './requests.service';
import { RequestType } from './enum/request-type.enum';
import { Public } from '../auth/decorators/public.decorator';
import { productStorage } from '../common/cloudinary/cloudinary-storage';
import { CommitRequestDto } from './dto/commit-request.dto';
import { PaginationDto } from '../common/pagination';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  findAll(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Query() query: PaginationDto,
  ) {
    return this.requestsService.findAll(req.user.sub, query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.findOne(id, req.user.sub);
  }

  /**
   * Download Excel template for a specific request type.
   */
  @Public()
  @Get('import/template')
  generateTemplate(
    @Query('type') requestType: RequestType,
    @Res() res: Response,
  ) {
    const file = this.requestsService.generateTemplate(requestType);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${requestType}.xlsx"`,
      'Content-Length': file.length.toString(),
    });

    return res.send(file);
  }

  /**
   * Create a new request manually with multipart form-data.
   */
  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: productStorage,
    }),
  )
  create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.createFromMultipart(body, files, req.user.sub);
  }

  /**
   * Bulk import a request from an Excel file.
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('requestType') requestType: RequestType,
    @Body('approvers') approversRaw: any,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.importFromExcel(
      file,
      requestType,
      approversRaw,
      req.user.sub,
    );
  }

  /**
   * Commit, approve, or reject a request.
   */
  @Post(':id/commit')
  commit(
    @Param('id') requestId: string,
    @Body() dto: CommitRequestDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.commit(requestId, req.user.sub, dto);
  }
}
