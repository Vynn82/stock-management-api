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
import { imageUploadOptions } from '../common/cloudinary/cloudinary-storage';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { CommitRequestDto } from './dto/commit-request.dto';
import { PaginationDto } from '../common/pagination';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @RequirePermission('REQUEST_VIEW')
  @Get()
  findAll(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
    @Query() query: PaginationDto,
  ) {
    return this.requestsService.findAll(req.user.sub, query);
  }

  /**
   * Users the requester may add as certifier/approver (STAFF cannot use /users).
   * Must stay above `:id`.
   */
  @RequirePermission('REQUEST_CREATE')
  @Get('approver-candidates')
  findApproverCandidates(
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.findApproverCandidates(req.user.sub);
  }

  @RequirePermission('REQUEST_VIEW')
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
  @RequirePermission('REQUEST_CREATE')
  @Post()
  @UseInterceptors(
    AnyFilesInterceptor(imageUploadOptions),
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
  @RequirePermission('REQUEST_CREATE')
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
  @RequirePermission('REQUEST_VIEW')
  @Post(':id/commit')
  commit(
    @Param('id') requestId: string,
    @Body() dto: CommitRequestDto,
    @Req() req: authenticatedUserInterface.AuthenticatedRequest,
  ) {
    return this.requestsService.commit(requestId, req.user.sub, dto);
  }
}
