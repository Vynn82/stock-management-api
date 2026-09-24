import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  EntityManager,
  IsNull,
  FindOptionsWhere,
  Not,
} from 'typeorm';

import { CreateRequestDto } from './dto/create-request.dto';
import { CreateRequestProductDto } from './dto/create-request-product.dto';
import { CreateRequestVariantDto } from './dto/create-request-variant.dto';
import { CreateRequestStockDto } from './dto/create-request-stock.dto';
import { CommitAction, CommitRequestDto } from './dto/commit-request.dto';

import { Request } from './entities/request.entity';
import { RequestItem } from './entities/request-item.entity';
import {
  Approver,
  ApproverActionType,
  ApproverStatus,
} from './entities/approver.entity';
import { User, UserStatus } from '../users/entities/user.entity';

import { RequestType } from './enum/request-type.enum';
import { RequestSource } from './enum/request-source.enum';
import { RequestStatus } from './enum/request-status.enum';
import { MailsService } from '../mails/mails.service';
import { Mail } from '../mails/entities/mail.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Category } from '../categories/entities/category.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { StockAdjustment } from '../stock-adjustments/entities/stock-adjustment.entity';
import {
  PaginationDto,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';

import { RequestsExcelService } from './requests-excel.service';
import { RequestImportTemplateService } from './request-import-template.service';
import { BarcodesService } from '../barcodes/barcodes.service';

@Injectable()
export class RequestsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Request)
    private readonly requestsRepository: Repository<Request>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailsService,
    private readonly requestsExcelService: RequestsExcelService,
    private readonly requestImportTemplateService: RequestImportTemplateService,
    private readonly barcodesService: BarcodesService,
  ) {}

  generateTemplate(requestType: RequestType) {
    return this.requestImportTemplateService.generateTemplate(requestType);
  }

  async importFromExcel(
    file: Express.Multer.File,
    requestType: RequestType,
    approversRaw: any,
    userId: string,
  ) {
    const dto = this.requestsExcelService.importExcel(file, requestType);
    if (approversRaw) {
      try {
        dto.approvers =
          typeof approversRaw === 'string'
            ? JSON.parse(approversRaw)
            : approversRaw;
      } catch {}
    }
    return this.create(dto, userId, RequestSource.EXCEL);
  }

  async findAll(userId: string, paginationDto?: PaginationDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);
    const search = paginationDto?.search?.trim();

    const queryBuilder = this.requestsRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.items', 'items')
      .leftJoinAndSelect('request.approvers', 'approvers')
      .leftJoinAndSelect('approvers.user', 'approverUser')
      .leftJoinAndSelect('approverUser.profile', 'approverProfile')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('requester.profile', 'requesterProfile');

    if (search) {
      queryBuilder.andWhere(
        '(request.requestNo ILIKE :search OR request.remark ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('request.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [requests, total] = await queryBuilder.getManyAndCount();

    const formattedData = requests.map((request) =>
      this.formatRequestResponse(request, userId),
    );

    return createPaginatedResult(formattedData, total, paginationDto);
  }

  async findOne(id: string, userId: string) {
    const request = await this.requestsRepository.findOne({
      where: {
        id,
      },
      relations: {
        items: true,
        approvers: { user: { profile: true } },
        requester: {
          profile: true,
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found`);
    }

    return this.formatRequestResponse(request, userId);
  }

  async createFromMultipart(
    body: any,
    files: Express.Multer.File[],
    userId: string,
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

    let productImageUrl: string | undefined;
    const variantImageUrls: Record<string, string> = {};

    for (const file of files ?? []) {
      if (file.fieldname === 'image') {
        productImageUrl = file.path;
        continue;
      }

      const match = file.fieldname.match(/^variantImage\[(.+)\]$/);
      if (match) {
        variantImageUrls[match[1]] = file.path;
      }
    }

    return this.create(
      createRequestDto,
      userId,
      RequestSource.MANUAL,
      productImageUrl,
      variantImageUrls,
    );
  }

  async create(
    dto: CreateRequestDto,
    requesterId: string,
    source: RequestSource = RequestSource.MANUAL,
    productImageUrl?: string,
    variantImageUrls?: Record<string, string>,
  ) {
    this.validateRequest(dto);

    return this.dataSource.transaction(async (manager) => {
      const requestNo = this.generateRequestNo();

      const request = manager.create(Request, {
        requestNo,
        requesterId,
        requestType: dto.requestType,
        source,
        status: RequestStatus.PENDING,
        currentStep: 1,
        remark: dto.remark ?? null,
      });

      const savedRequest = await manager.save(Request, request);
      if (dto.product?.supplierCode) {
        const supplier = await manager.findOne(Supplier, {
          where: {
            code: dto.product.supplierCode,
            isActive: true,
          },
        });

        if (!supplier) {
          throw new BadRequestException(
            `Supplier ${dto.product.supplierCode} not found or inactive`,
          );
        }
      }

      const requestItems = this.buildRequestItems(
        dto,
        savedRequest.id,
        productImageUrl,
        variantImageUrls,
      );

      if (requestItems.length > 0) {
        await manager.save(RequestItem, requestItems);
      }

      const approvers = await this.buildApprovers(
        dto,
        savedRequest.id,
        requesterId,
        manager,
      );

      if (approvers.length > 0) {
        await manager.save(Approver, approvers);

        const firstApprover = approvers
          .filter((approver) => approver.step === 1)
          .sort((a, b) => a.step - b.step)[0];

        // ============================================
        // MAIL → FIRST CERTIFIER / APPROVER
        // ============================================

        if (firstApprover) {
          await this.mailService.createMail({
            recipientId: firstApprover.userId,
            requestId: savedRequest.id,
            requestType: savedRequest.requestType,
            subject: `New ${savedRequest.requestType} request requires your action`,
            message: `Request ${savedRequest.requestNo} has been submitted and is waiting for your action.`,
            action: 'PENDING',
            requestUrl: `/requests/${savedRequest.id}`,
          });
        }

        // ============================================
        // MAIL → REQUESTER
        // ============================================

        await this.mailService.createMail({
          recipientId: requesterId,
          requestId: savedRequest.id,
          requestType: savedRequest.requestType,
          subject: `${savedRequest.requestType} request created`,
          message: `Your request ${savedRequest.requestNo} has been created and is waiting for approval.`,
          action: 'CREATED',
          requestUrl: `/requests/${savedRequest.id}`,
        });
      }
      return {
        message: 'Request created successfully',
        requestId: savedRequest.id,
        requestNo: savedRequest.requestNo,
        requestType: savedRequest.requestType,
        source: savedRequest.source,
        status: savedRequest.status,
        currentStep: savedRequest.currentStep,
      };
    });
  }

  async commitV1(requestId: string, userId: string, dto: CommitRequestDto) {
    return this.dataSource.transaction(async (manager) => {
      // =====================================================
      // 1. FIND REQUEST
      // =====================================================

      const request = await manager.findOne(Request, {
        where: {
          id: requestId,
        },
        relations: {
          items: true,
          approvers: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // =====================================================
      // 2. CHECK REQUEST STATUS
      // =====================================================

      if (request.status !== RequestStatus.PENDING) {
        throw new BadRequestException(
          `Request cannot be committed because it is already ${request.status}`,
        );
      }

      // =====================================================
      // 3. FIND CURRENT USER'S APPROVER RECORD
      // =====================================================

      const approver = await manager.findOne(Approver, {
        where: {
          requestId,
          userId,
        },
        relations: {
          user: {
            profile: true,
          },
        },
      });

      if (!approver) {
        throw new ForbiddenException('You are not assigned to this request.');
      }

      // =====================================================
      // 4. GET ACTOR NAME
      // =====================================================

      const actorName = approver.user?.profile
        ? `${approver.user.profile.firstName} ${approver.user.profile.lastName}`.trim()
        : (approver.user?.staffId ?? 'Unknown user');

      // =====================================================
      // 5. CHECK APPROVAL STEP
      // =====================================================

      if (approver.step < request.currentStep) {
        throw new BadRequestException(
          'You have already completed your approval step for this request.',
        );
      }

      if (approver.step > request.currentStep) {
        throw new BadRequestException(
          'It is not your turn yet. Please wait for the previous approval step to be completed.',
        );
      }

      // =====================================================
      // 6. CHECK APPROVER STATUS
      // =====================================================

      if (approver.status !== ApproverStatus.PENDING) {
        throw new BadRequestException(
          'You have already completed your approval step for this request.',
        );
      }

      // =====================================================
      // 7. MARK CURRENT USER'S MAIL AS READ
      // =====================================================

      const mail = await manager.findOne(Mail, {
        where: {
          requestId: request.id,
          recipientId: userId,
          isRead: false,
        },
      });

      if (mail) {
        mail.isRead = true;
        await manager.save(Mail, mail);
      }

      // =====================================================
      // 8. SAVE ACTION INFORMATION
      // =====================================================

      approver.remark = dto.remark ?? null;
      approver.actionDate = new Date();

      // =====================================================
      // 9. REJECT
      // =====================================================

      if (dto.action === CommitAction.REJECT) {
        approver.status = ApproverStatus.REJECTED;

        request.status = RequestStatus.REJECTED;

        await manager.save(Approver, approver);
        await manager.save(Request, request);

        // ===================================================
        // MAIL → REQUESTER
        // ===================================================

        await this.mailService.createMail({
          recipientId: request.requesterId,
          requestId: request.id,
          requestType: request.requestType,
          subject: `${request.requestType} request rejected`,
          message: `Request ${request.requestNo} has been rejected by ${actorName}.`,
          action: 'REJECTED',
          requestUrl: `/requests/${request.id}`,
        });

        return {
          message: 'Request rejected successfully',
          requestId: request.id,
          status: request.status,
          currentStep: request.currentStep,
        };
      }

      // =====================================================
      // 10. APPROVE CURRENT STEP
      // =====================================================

      approver.status = ApproverStatus.APPROVED;

      await manager.save(Approver, approver);

      // =====================================================
      // 11. FIND NEXT APPROVER
      // =====================================================

      const nextApprover = await manager.findOne(Approver, {
        where: {
          requestId: request.id,
          step: request.currentStep + 1,
        },
      });

      // =====================================================
      // 12. THERE IS A NEXT APPROVER
      // =====================================================

      if (nextApprover) {
        nextApprover.status = ApproverStatus.PENDING;

        await manager.save(Approver, nextApprover);

        // Move request to next step
        request.currentStep++;

        await manager.save(Request, request);

        // ===================================================
        // DETERMINE ACTION NAME
        // ===================================================

        const actionName =
          approver.actionType === ApproverActionType.CERTIFIER
            ? 'certified'
            : 'approved';

        // ===================================================
        // MAIL → NEXT APPROVER
        // ===================================================

        await this.mailService.createMail({
          recipientId: nextApprover.userId,
          requestId: request.id,
          requestType: request.requestType,
          subject: `New ${request.requestType} request requires your action`,
          message: `Request ${request.requestNo} is now waiting for your action.`,
          action: 'PENDING',
          requestUrl: `/requests/${request.id}`,
        });

        // ===================================================
        // MAIL → REQUESTER
        // ===================================================

        await this.mailService.createMail({
          recipientId: request.requesterId,
          requestId: request.id,
          requestType: request.requestType,
          subject: `${request.requestType} request moved to next step`,
          message: `Request ${request.requestNo} has been ${actionName} by ${actorName} and moved to step ${request.currentStep}.`,
          action: 'STEP_COMPLETED',
          requestUrl: `/requests/${request.id}`,
        });

        return {
          message: 'Request approved for current step',
          requestId: request.id,
          status: request.status,
          currentStep: request.currentStep,
        };
      }

      // =====================================================
      // 13. NO NEXT APPROVER → FULLY APPROVED
      // =====================================================

      /// insert to product
      const product = await this.createProductFromRequest(manager, request);

      const variants = await this.createProductVariantsFromRequest(
        manager,
        request,
        product,
      );

      // Create stock
      const stocks = await this.createStocksFromRequest(
        manager,
        request,
        product,
        variants,
      );

      request.status = RequestStatus.APPROVED;

      await manager.save(Request, request);

      // =====================================================
      // 14. MAIL → REQUESTER
      // =====================================================

      await this.mailService.createMail({
        recipientId: request.requesterId,
        requestId: request.id,
        requestType: request.requestType,
        subject: `${request.requestType} request approved`,
        message: `Request ${request.requestNo} has been fully approved.`,
        action: 'APPROVED',
        requestUrl: `/requests/${request.id}`,
      });

      // =====================================================
      // 15. RETURN
      // =====================================================

      return {
        message: 'Request approved successfully',
        requestId: request.id,
        status: request.status,
        currentStep: request.currentStep,
      };
    });
  }

  async commit(requestId: string, userId: string, dto: CommitRequestDto) {
    return this.dataSource.transaction(async (manager) => {
      // =====================================================
      // 1. FIND REQUEST
      // =====================================================

      const request = await manager.findOne(Request, {
        where: {
          id: requestId,
        },
        relations: {
          items: true,
          approvers: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Request not found');
      }

      // =====================================================
      // 2. CHECK REQUEST STATUS
      // =====================================================

      if (request.status !== RequestStatus.PENDING) {
        throw new BadRequestException(
          `Request cannot be committed because it is already ${request.status}`,
        );
      }

      // =====================================================
      // 3. FIND CURRENT USER'S APPROVER RECORD
      // =====================================================

      const approver = await manager.findOne(Approver, {
        where: {
          requestId,
          userId,
        },
        relations: {
          user: {
            profile: true,
          },
        },
      });

      if (!approver) {
        throw new ForbiddenException('You are not assigned to this request.');
      }

      // =====================================================
      // 4. GET ACTOR NAME
      // =====================================================

      const actorName = `${approver.user?.profile?.firstName ?? ''} ${
        approver.user?.profile?.lastName ?? ''
      }`.trim();

      // =====================================================
      // 5. CHECK APPROVAL STEP
      // =====================================================

      if (approver.step < request.currentStep) {
        throw new BadRequestException(
          'You have already completed your approval step for this request.',
        );
      }

      if (approver.step > request.currentStep) {
        throw new BadRequestException(
          'It is not your turn yet. Please wait for the previous approval step to be completed.',
        );
      }

      // =====================================================
      // 6. CHECK APPROVER STATUS
      // =====================================================

      if (approver.status !== ApproverStatus.PENDING) {
        throw new BadRequestException(
          'You have already completed your approval step for this request.',
        );
      }

      // =====================================================
      // 7. MARK CURRENT USER'S MAIL AS READ
      // =====================================================

      const mail = await manager.findOne(Mail, {
        where: {
          requestId: request.id,
          recipientId: userId,
          isRead: false,
          action: 'PENDING',
        },
      });

      if (mail) {
        mail.isRead = true;
        await manager.save(Mail, mail);
      }

      // =====================================================
      // 8. SAVE ACTION INFORMATION
      // =====================================================

      approver.remark = dto.remark ?? null;
      approver.actionDate = new Date();

      // =====================================================
      // 9. REJECT
      // =====================================================

      if (dto.action === CommitAction.REJECT) {
        approver.status = ApproverStatus.REJECTED;

        request.status = RequestStatus.REJECTED;

        await manager.save(Approver, approver);
        await manager.save(Request, request);

        // -----------------------------------------------------
        // Notify requester
        // -----------------------------------------------------

        await this.mailService.createMail({
          recipientId: request.requesterId,
          requestId: request.id,
          requestType: request.requestType,
          subject: 'Product request rejected',
          message: `Request ${request.requestNo} has been rejected by ${actorName}.`,
          action: 'REJECTED',
          requestUrl: `/requests/${request.id}`,
        });

        return {
          message: 'Request rejected successfully',
          requestId: request.id,
          status: request.status,
          currentStep: request.currentStep,
        };
      }

      // =====================================================
      // 10. APPROVE CURRENT STEP
      // =====================================================

      approver.status = ApproverStatus.APPROVED;

      await manager.save(Approver, approver);

      // =====================================================
      // 11. FIND NEXT APPROVER
      // =====================================================

      const nextApprover = await manager.findOne(Approver, {
        where: {
          requestId: request.id,
          step: request.currentStep + 1,
        },
        relations: {
          user: {
            profile: true,
          },
        },
      });

      // =====================================================
      // 12. NEXT APPROVER EXISTS
      // =====================================================

      if (nextApprover) {
        nextApprover.status = ApproverStatus.PENDING;

        await manager.save(Approver, nextApprover);

        // Move request to next step
        request.currentStep++;

        await manager.save(Request, request);

        // -----------------------------------------------------
        // Notify next approver
        // -----------------------------------------------------

        await this.mailService.createMail({
          recipientId: nextApprover.userId,
          requestId: request.id,
          requestType: request.requestType,
          subject: `New ${request.requestType} request requires your action`,
          message: `Request ${request.requestNo} is now waiting for your action. ${actorName} has completed their ${approver.actionType.toLowerCase()} step.`,
          action: 'PENDING',
          requestUrl: `/requests/${request.id}`,
        });

        // -----------------------------------------------------
        // Optional: notify requester about progress
        // -----------------------------------------------------

        await this.mailService.createMail({
          recipientId: request.requesterId,
          requestId: request.id,
          requestType: request.requestType,
          subject: 'Product request updated',
          message: `${actorName} has completed their ${approver.actionType.toLowerCase()} step for request ${request.requestNo}. The request is now waiting for the next approval.`,
          action: 'PENDING',
          requestUrl: `/requests/${request.id}`,
        });

        return {
          message: 'Request approved for current step',
          requestId: request.id,
          status: request.status,
          currentStep: request.currentStep,
        };
      }

      // =====================================================
      // 13. FINAL APPROVER
      // =====================================================

      // At this point, there is no next approver.
      // This means the current approver is the final approver.

      // =====================================================
      // 13. PROCESS REQUEST
      // =====================================================

      switch (request.requestType) {
        case RequestType.PRODUCT_CREATE: {
          const product = await this.createProductFromRequest(manager, request);

          const variants = await this.createProductVariantsFromRequest(
            manager,
            request,
            product,
          );

          await this.createStocksFromRequest(
            manager,
            request,
            product,
            variants,
          );

          break;
        }

        case RequestType.PRODUCT_UPDATE: {
          await this.createProductFromRequest(manager, request);

          break;
        }

        case RequestType.VARIANT_CREATE:
        case RequestType.VARIANT_UPDATE: {
          const product = await this.createProductFromRequest(manager, request);

          await this.createProductVariantsFromRequest(
            manager,
            request,
            product,
          );

          break;
        }

        // case RequestType.STOCK_IN:
        // case RequestType.STOCK_OUT:
        // case RequestType.STOCK_TRANSFER: {
        //   // Your existing stock processing here
        //   break;
        // }

        case RequestType.STOCK_IN: {
          await this.stockInFromRequest(manager, request);
          break;
        }

        case RequestType.STOCK_OUT: {
          await this.stockOutFromRequest(manager, request);
          break;
        }

        case RequestType.STOCK_TRANSFER: {
          await this.stockTransferFromRequest(manager, request);
          break;
        }

        case RequestType.STOCK_ADJUSTMENT: {
          await this.adjustStockFromRequest(manager, request);
          break;
        }

        case RequestType.STOCK_ADJUSTMENT: {
          await this.adjustStockFromRequest(manager, request);

          break;
        }

        default:
          throw new BadRequestException(
            `Unsupported request type: ${request.requestType}`,
          );
      }

      // =====================================================
      // 14. MARK REQUEST AS FULLY APPROVED
      // =====================================================

      request.status = RequestStatus.APPROVED;

      await manager.save(Request, request);

      // =====================================================
      // 15. NOTIFY REQUESTER
      // =====================================================

      await this.mailService.createMail({
        recipientId: request.requesterId,
        requestId: request.id,
        requestType: request.requestType,
        subject: 'Product request approved',
        message: `Request ${request.requestNo} has been fully approved by ${actorName}.`,
        action: 'APPROVED',
        requestUrl: `/requests/${request.id}`,
      });

      // =====================================================
      // 16. RETURN
      // =====================================================

      return {
        message: 'Request approved successfully',
        requestId: request.id,
        status: request.status,
        currentStep: request.currentStep,
      };
    });
  }

  /// ========= Helper func ==============
  private generateRequestNo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(100000 + Math.random() * 900000);

    return `REQ-${year}${month}${day}-${random}`;
  }

  private validateRequest(dto: CreateRequestDto): void {
    switch (dto.requestType) {
      case RequestType.PRODUCT_CREATE:
        this.validateProductCreate(dto);
        break;
      case RequestType.PRODUCT_UPDATE:
        this.validateProductUpdate(dto);
        break;
      case RequestType.VARIANT_CREATE:
      case RequestType.VARIANT_UPDATE:
        this.validateVariantCreateOrUpdate(dto);
        break;
      case RequestType.STOCK_IN:
      case RequestType.STOCK_OUT:
        this.validateStock(dto);
        break;
      case RequestType.STOCK_TRANSFER:
        this.validateStockTransfer(dto);
        break;
      case RequestType.STOCK_ADJUSTMENT:
        this.validateStockAdjustment(dto);
        break;
      default:
        throw new BadRequestException('Unsupported request type');
    }
  }

  private validateProductCreate(dto: CreateRequestDto): void {
    if (!dto.product) {
      throw new BadRequestException('Product is required');
    }

    const { productCode, productName, categoryCode, unit, hasVariants } =
      dto.product;

    if (!productCode) throw new BadRequestException('Product code is required');
    if (!productName) throw new BadRequestException('Product name is required');
    if (!categoryCode)
      throw new BadRequestException('Category code is required');
    if (!unit) throw new BadRequestException('Unit is required');

    if (hasVariants === true && (!dto.variants || dto.variants.length === 0)) {
      throw new BadRequestException(
        'Variants are required when hasVariants is true',
      );
    }

    if (hasVariants === false && dto.variants && dto.variants.length > 0) {
      throw new BadRequestException(
        'Product without variants cannot contain variants',
      );
    }

    if (!dto.stock || dto.stock.length === 0) {
      throw new BadRequestException('Initial stock is required');
    }

    this.validateProductCreateStock(dto);
  }

  private validateProductCreateStock(dto: CreateRequestDto): void {
    for (const item of dto.stock ?? []) {
      if (!item.productCode) {
        throw new BadRequestException('Product code is required in stock');
      }

      if (!item.warehouseCode) {
        throw new BadRequestException('Warehouse code is required in stock');
      }

      if (item.quantity === undefined || item.quantity <= 0) {
        throw new BadRequestException('Stock quantity must be greater than 0');
      }

      if (dto.product?.hasVariants === true && !item.variantCode) {
        throw new BadRequestException(
          'Variant code is required for variant stock',
        );
      }

      if (dto.product?.hasVariants === false && item.variantCode) {
        throw new BadRequestException(
          'Variant code is not allowed for a product without variants',
        );
      }
    }
  }

  private validateProductUpdate(dto: CreateRequestDto): void {
    if (!dto.product) {
      throw new BadRequestException('Product is required');
    }

    if (!dto.product.productCode) {
      throw new BadRequestException('Product code is required');
    }
  }

  private validateVariantCreateOrUpdate(dto: CreateRequestDto): void {
    if (!dto.product?.productCode) {
      throw new BadRequestException('Product code is required');
    }

    if (!dto.variants || dto.variants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }

    for (const variant of dto.variants) {
      if (!variant.variantCode) {
        throw new BadRequestException('Variant code is required');
      }
    }
  }

  private validateStock(dto: CreateRequestDto): void {
    if (!dto.stock || dto.stock.length === 0) {
      throw new BadRequestException('Stock is required');
    }

    for (const item of dto.stock) {
      if (!item.productCode) {
        throw new BadRequestException('Product code is required');
      }

      if (!item.warehouseCode) {
        throw new BadRequestException('Warehouse code is required');
      }

      if (item.quantity === undefined || item.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than 0');
      }
    }
  }

  private validateStockTransfer(dto: CreateRequestDto): void {
    if (!dto.stock || dto.stock.length === 0) {
      throw new BadRequestException('Stock is required');
    }

    for (const item of dto.stock) {
      if (!item.productCode) {
        throw new BadRequestException('Product code is required');
      }

      if (!item.fromWarehouseCode) {
        throw new BadRequestException('From warehouse is required');
      }

      if (!item.toWarehouseCode) {
        throw new BadRequestException('To warehouse is required');
      }

      if (item.fromWarehouseCode === item.toWarehouseCode) {
        throw new BadRequestException(
          'From and to warehouse cannot be the same',
        );
      }

      if (item.quantity === undefined || item.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than 0');
      }
    }
  }

  private validateStockAdjustment(dto: CreateRequestDto): void {
    if (!dto.adjustments || dto.adjustments.length === 0) {
      throw new BadRequestException('Adjustment items are required');
    }

    for (const item of dto.adjustments) {
      // =========================
      // PRODUCT
      // =========================

      if (!item.productCode?.trim()) {
        throw new BadRequestException('Product code is required');
      }

      // =========================
      // VARIANT
      // =========================

      if (item.variantCode !== undefined && item.variantCode !== null) {
        if (!item.variantCode.trim()) {
          throw new BadRequestException('Variant code cannot be empty');
        }
      }

      // =========================
      // WAREHOUSE
      // =========================

      if (!item.warehouseCode?.trim()) {
        throw new BadRequestException('Warehouse code is required');
      }

      // =========================
      // ADJUSTMENT TYPE
      // =========================

      if (!item.adjustmentType) {
        throw new BadRequestException('Adjustment type is required');
      }

      // =========================
      // QUANTITY
      // =========================

      if (
        item.quantity === undefined ||
        item.quantity === null ||
        item.quantity <= 0
      ) {
        throw new BadRequestException(
          'Adjustment quantity must be greater than 0',
        );
      }

      // =========================
      // REASON
      // =========================

      if (!item.reason?.trim()) {
        throw new BadRequestException('Adjustment reason is required');
      }
    }
  }
  private buildRequestItems(
    dto: CreateRequestDto,
    requestId: string,
    productImageUrl?: string,
    variantImageUrls?: Record<string, string>,
  ): RequestItem[] {
    const items: RequestItem[] = [];

    // ==========================================
    // PRODUCT CREATE
    // ==========================================

    if (dto.requestType === RequestType.PRODUCT_CREATE) {
      if (dto.product?.hasVariants) {
        for (const variant of dto.variants ?? []) {
          const stock =
            dto.stock?.filter(
              (item) => item.variantCode === variant.variantCode,
            ) ?? [];

          const variantImageUrl = variantImageUrls?.[variant.variantCode];

          if (stock.length > 0) {
            for (const stockItem of stock) {
              items.push(
                this.createRequestItem(
                  requestId,
                  dto,
                  variant,
                  stockItem,
                  productImageUrl,
                  variantImageUrl,
                ),
              );
            }
          } else {
            items.push(
              this.createRequestItem(
                requestId,
                dto,
                variant,
                undefined,
                productImageUrl,
                variantImageUrl,
              ),
            );
          }
        }
      } else {
        for (const stockItem of dto.stock ?? []) {
          items.push(
            this.createRequestItem(
              requestId,
              dto,
              undefined,
              stockItem,
              productImageUrl,
            ),
          );
        }
      }
    }

    // ==========================================
    // PRODUCT UPDATE
    // ==========================================

    if (dto.requestType === RequestType.PRODUCT_UPDATE) {
      items.push(
        this.createRequestItem(
          requestId,
          dto,
          undefined,
          undefined,
          productImageUrl,
        ),
      );
    }

    // ==========================================
    // VARIANT CREATE / UPDATE
    // ==========================================

    if (
      dto.requestType === RequestType.VARIANT_CREATE ||
      dto.requestType === RequestType.VARIANT_UPDATE
    ) {
      for (const variant of dto.variants ?? []) {
        items.push(
          this.createRequestItem(
            requestId,
            dto,
            variant,
            undefined,
            productImageUrl,
            variantImageUrls?.[variant.variantCode],
          ),
        );
      }
    }

    // ==========================================
    // STOCK IN / OUT / TRANSFER
    // ==========================================

    if (
      [
        RequestType.STOCK_IN,
        RequestType.STOCK_OUT,
        RequestType.STOCK_TRANSFER,
      ].includes(dto.requestType)
    ) {
      for (const stockItem of dto.stock ?? []) {
        items.push(
          this.createRequestItem(
            requestId,
            dto,
            undefined,
            stockItem,
            productImageUrl,
          ),
        );
      }
    }

    // ==========================================
    // STOCK ADJUSTMENT
    // ==========================================

    if (dto.requestType === RequestType.STOCK_ADJUSTMENT) {
      this.validateStockAdjustment(dto);

      for (const adjustment of dto.adjustments ?? []) {
        items.push(
          this.createRequestItem(
            requestId,
            dto,
            undefined,
            {
              productCode: adjustment.productCode,
              variantCode: adjustment.variantCode ?? null,
              warehouseCode: adjustment.warehouseCode,
              quantity: adjustment.quantity,
              costPrice: adjustment.costPrice ?? adjustment.basePrice ?? null,
              basePrice: adjustment.basePrice ?? adjustment.costPrice ?? null,
              sellingPrice: adjustment.sellingPrice ?? null,

              adjustmentType: adjustment.adjustmentType,
              adjustmentReason: adjustment.reason,
            },
            productImageUrl,
          ),
        );
      }
    }

    return items;
  }

  private buildRequestItemsV1(
    dto: CreateRequestDto,
    requestId: string,
    productImageUrl?: string,
    variantImageUrls?: Record<string, string>,
  ): RequestItem[] {
    const items: RequestItem[] = [];

    if (dto.requestType === RequestType.PRODUCT_CREATE) {
      if (dto.product?.hasVariants) {
        for (const variant of dto.variants ?? []) {
          const stock =
            dto.stock?.filter(
              (item) => item.variantCode === variant.variantCode,
            ) ?? [];
          const variantImageUrl = variantImageUrls?.[variant.variantCode];

          if (stock.length > 0) {
            for (const stockItem of stock) {
              items.push(
                this.createRequestItem(
                  requestId,
                  dto,
                  variant,
                  stockItem,
                  productImageUrl,
                  variantImageUrl,
                ),
              );
            }
          } else {
            items.push(
              this.createRequestItem(
                requestId,
                dto,
                variant,
                undefined,
                productImageUrl,
                variantImageUrl,
              ),
            );
          }
        }
      } else {
        for (const stockItem of dto.stock ?? []) {
          items.push(
            this.createRequestItem(
              requestId,
              dto,
              undefined,
              stockItem,
              productImageUrl,
            ),
          );
        }
      }
    }

    if (dto.requestType === RequestType.PRODUCT_UPDATE) {
      items.push(
        this.createRequestItem(
          requestId,
          dto,
          undefined,
          undefined,
          productImageUrl,
        ),
      );
    }

    if (
      dto.requestType === RequestType.VARIANT_CREATE ||
      dto.requestType === RequestType.VARIANT_UPDATE
    ) {
      for (const variant of dto.variants ?? []) {
        items.push(
          this.createRequestItem(
            requestId,
            dto,
            variant,
            undefined,
            productImageUrl,
            variantImageUrls?.[variant.variantCode],
          ),
        );
      }
    }

    if (
      [
        RequestType.STOCK_IN,
        RequestType.STOCK_OUT,
        RequestType.STOCK_ADJUSTMENT,
        RequestType.STOCK_TRANSFER,
      ].includes(dto.requestType)
    ) {
      for (const stockItem of dto.stock ?? []) {
        items.push(
          this.createRequestItem(
            requestId,
            dto,
            undefined,
            stockItem,
            productImageUrl,
          ),
        );
      }
    }

    return items;
  }

  private createRequestItem(
    requestId: string,
    dto: CreateRequestDto,
    variant?: any,
    stock?: any,
    productImageUrl?: string,
    variantImageUrl?: string,
  ): RequestItem {
    const item = new RequestItem();

    item.requestId = requestId;
    item.productCode = dto.product?.productCode ?? stock?.productCode ?? '';
    item.productName = dto.product?.productName ?? '';
    item.productImage = productImageUrl ?? null;
    item.description = dto.product?.description ?? null;
    item.categoryCode = dto.product?.categoryCode ?? '';
    item.brandCode = dto.product?.brandCode ?? null;
    item.supplierCode = dto.product?.supplierCode ?? null;
    item.hasVariants = dto.product?.hasVariants ?? false;
    item.unit = dto.product?.unit ?? '';
    item.productSku = dto.product?.productSku ?? '';
    item.productBarcode = dto.product?.productBarcode ?? null;
    item.productCostPrice =
      dto.product?.productCostPrice ??
      (dto.product as any)?.basePrice ??
      stock?.costPrice ??
      stock?.basePrice ??
      null;
    item.productSellingPrice =
      dto.product?.productSellingPrice ??
      (dto.product as any)?.sellingPrice ??
      stock?.sellingPrice ??
      null;
    item.minimumStock = dto.product?.minimumStock ?? null;
    item.maximumStock = dto.product?.maximumStock ?? null;

    item.variantCode = variant?.variantCode ?? stock?.variantCode ?? null;
    item.variantName = variant?.variantName ?? null;
    item.variantSku = variant?.variantSku ?? null;
    item.variantBarcode = variant?.variantBarcode ?? null;
    item.variantAttributes = variant?.variantAttributes ?? null;
    item.variantImage = variantImageUrl ?? null;
    item.variantCostPrice =
      variant?.variantCostPrice ??
      (variant as any)?.basePrice ??
      stock?.variantCostPrice ??
      stock?.variantBasePrice ??
      stock?.costPrice ??
      stock?.basePrice ??
      null;
    item.variantSellingPrice =
      variant?.variantSellingPrice ??
      (variant as any)?.sellingPrice ??
      stock?.variantSellingPrice ??
      stock?.sellingPrice ??
      null;

    item.warehouseCode = stock?.warehouseCode ?? null;
    item.quantity = stock?.quantity ?? null;
    item.fromWarehouseCode = stock?.fromWarehouseCode ?? null;
    item.toWarehouseCode = stock?.toWarehouseCode ?? null;

    item.adjustmentType = stock?.adjustmentType ?? null;
    item.adjustmentReason = stock?.adjustmentReason ?? null;

    return item;
  }
  private async buildApprovers(
    dto: CreateRequestDto,
    requestId: string,
    requesterId: string,
    manager: EntityManager,
  ): Promise<Approver[]> {
    const approverDtos = dto.approvers ? [...dto.approvers] : [];

    if (approverDtos.length === 0) {
      const approverUsers = await manager
        .createQueryBuilder(User, 'user')
        .innerJoin('user.userRoles', 'userRole')
        .innerJoin('userRole.role', 'role')
        .where('role.name IN (:...roles)', {
          roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
        })
        .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
        .andWhere('user.id != :requesterId', { requesterId })
        .getMany();

      if (approverUsers.length > 0) {
        approverDtos.push({
          userId: approverUsers[0].id,
          actionType: ApproverActionType.APPROVER,
        });
      } else {
        const otherUser = await manager.findOne(User, {
          where: {
            status: UserStatus.ACTIVE,
            id: Not(requesterId),
          },
        });
        if (otherUser) {
          approverDtos.push({
            userId: otherUser.id,
            actionType: ApproverActionType.CERTIFIER,
          });
        } else {
          throw new BadRequestException(
            'At least one certifier or approver is required',
          );
        }
      }
    }

    const userIds = approverDtos.map((item) => item.userId);

    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestException('A user cannot be assigned more than once');
    }

    const users = await manager.find(User, {
      where: userIds.map((id) => ({
        id,
      })),
      relations: {
        userRoles: {
          role: true,
        },
      },
    });

    if (users.length !== userIds.length) {
      const foundIds = new Set(users.map((user) => user.id));

      const missingUserIds = userIds.filter((id) => !foundIds.has(id));

      throw new BadRequestException(
        `User(s) not found: ${missingUserIds.join(', ')}`,
      );
    }

    const userMap = new Map(users.map((user) => [user.id, user]));

    const approvers: Approver[] = [];

    for (let index = 0; index < approverDtos.length; index++) {
      const approverDto = approverDtos[index];
      if (approverDto.userId === requesterId) {
        throw new BadRequestException(
          'Requester cannot be assigned as a certifier or approver',
        );
      }

      const user = userMap.get(approverDto.userId);

      if (!user) {
        throw new BadRequestException(
          `User ${approverDto.userId} does not exist`,
        );
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new BadRequestException(`User ${user.staffId} is not active`);
      }

      const roles = user.userRoles.map((userRole) => userRole.role.name);

      if (approverDto.actionType === ApproverActionType.APPROVER) {
        const canApprove =
          roles.includes('SUPER_ADMIN') ||
          roles.includes('ADMIN') ||
          roles.includes('MANAGER');

        if (!canApprove) {
          throw new BadRequestException(
            `User ${user.staffId} cannot be an approver. Only ADMIN, MANAGER, or SUPER_ADMIN can be approvers.`,
          );
        }
      }

      const approver = manager.create(Approver, {
        requestId,
        userId: user.id,
        step: index + 1,
        actionType: approverDto.actionType,
        status: index === 0 ? ApproverStatus.PENDING : ApproverStatus.WAITING,
        actionDate: null,
        remark: null,
      });

      approvers.push(approver);
    }

    return approvers;
  }

  private async buildApproversOLD(
    dto: CreateRequestDto,
    requestId: string,
  ): Promise<Approver[]> {
    const approverDtos = dto.approvers ?? [];

    if (approverDtos.length === 0) {
      throw new BadRequestException(
        'At least one certifier or approver is required',
      );
    }

    const userIds = approverDtos.map((item) => item.userId);
    const users = await this.userRepository.find({
      where: userIds.map((id) => ({ id })),
      relations: { userRoles: { role: true } },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more selected users do not exist');
    }

    const userMap = new Map(users.map((user) => [user.id, user]));

    return approverDtos.map((item, index) => {
      const user = userMap.get(item.userId);

      if (!user) {
        throw new BadRequestException(`User ${item.userId} does not exist`);
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new BadRequestException(`User ${user.staffId} is not active`);
      }

      if (item.actionType === ApproverActionType.APPROVER) {
        const roles = user.userRoles.map((ur) => ur.role.name);
        const canApprove = roles.some((role) =>
          ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        );

        if (!canApprove) {
          throw new BadRequestException(
            `User ${user.staffId} cannot be an approver. Only ADMIN or MANAGER can be approvers.`,
          );
        }
      }

      const approver = new Approver();
      approver.requestId = requestId;
      approver.userId = user.id;
      approver.step = index + 1;
      approver.actionType = item.actionType;
      approver.status =
        index === 0 ? ApproverStatus.PENDING : ApproverStatus.WAITING;

      return approver;
    });
  }

  private formatRequestResponse(request: Request, userId?: string) {
    const firstItem = request.items?.[0];

    const requesterName = request.requester?.profile
      ? `${request.requester.profile.firstName} ${request.requester.profile.lastName}`.trim()
      : null;

    return {
      id: request.id,
      requestNo: request.requestNo,

      requesterId: request.requesterId,
      requesterName,

      requestType: request.requestType,
      source: request.source,
      status: request.status,
      currentStep: request.currentStep,
      remark: request.remark,

      product: firstItem
        ? {
            productCode: firstItem.productCode,
            productName: firstItem.productName,
            productImage: firstItem.productImage,
            description: firstItem.description,
            categoryCode: firstItem.categoryCode,
            brandCode: firstItem.brandCode,
            supplierCode: firstItem.supplierCode,
            hasVariants: firstItem.hasVariants,
            unit: firstItem.unit,
            productSku: firstItem.productSku,
            productBarcode: firstItem.productBarcode,
            productCostPrice: firstItem.productCostPrice,
            productSellingPrice: firstItem.productSellingPrice,
            minimumStock: firstItem.minimumStock,
            maximumStock: firstItem.maximumStock,
          }
        : null,

      variants:
        request.items
          ?.filter((item) => item.variantCode !== null)
          .map((item) => ({
            variantCode: item.variantCode,
            variantName: item.variantName,
            variantSku: item.variantSku,
            variantBarcode: item.variantBarcode,
            variantAttributes: item.variantAttributes,
            variantImage: item.variantImage,
            variantCostPrice: item.variantCostPrice,
            variantSellingPrice: item.variantSellingPrice,
          })) ?? [],

      stock:
        request.items
          ?.filter((item) => item.warehouseCode !== null)
          .map((item) => ({
            warehouseCode: item.warehouseCode,
            variantCode: item.variantCode,
            quantity: item.quantity,
            fromWarehouseCode: item.fromWarehouseCode,
            toWarehouseCode: item.toWarehouseCode,
            adjustmentType: item.adjustmentType,
            adjustmentReason: item.adjustmentReason,
          })) ?? [],
      approvers:
        request.approvers?.map((approver) => ({
          ...this.formatApproverResponse(approver),

          canAct:
            approver.userId === userId &&
            approver.step === request.currentStep &&
            approver.status === ApproverStatus.PENDING &&
            request.status === RequestStatus.PENDING,
        })) ?? [],

      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private formatApproverResponse(approver: Approver) {
    const profile = approver.user?.profile;

    return {
      id: approver.id,
      userId: approver.userId,
      staffId: approver.user?.staffId ?? null,
      name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : null,
      avatar: profile?.avatar ?? null,
      step: approver.step,
      actionType: approver.actionType,
      status: approver.status,
      actionDate: approver.actionDate,
      remark: approver.remark,
    };
  }

  private async createProductFromRequest(
    manager: EntityManager,
    request: Request,
  ): Promise<Product> {
    const item = request.items?.[0];

    if (!item) {
      throw new BadRequestException(
        'Cannot create product because request has no items',
      );
    }

    // =====================================================
    // 1. FIND CATEGORY
    // =====================================================

    const category = await manager.findOne(Category, {
      where: {
        code: item.categoryCode,
      },
    });

    if (!category) {
      throw new BadRequestException(`Category ${item.categoryCode} not found`);
    }

    // =====================================================
    // 2. FIND BRAND
    // =====================================================

    let brand: Brand | null = null;

    if (item.brandCode) {
      brand = await manager.findOne(Brand, {
        where: {
          code: item.brandCode,
        },
      });

      if (!brand) {
        throw new BadRequestException(`Brand ${item.brandCode} not found`);
      }
    }

    // =====================================================
    // 3. FIND SUPPLIER
    // =====================================================

    let supplier: Supplier | null = null;

    if (item.supplierCode) {
      supplier = await manager.findOne(Supplier, {
        where: {
          code: item.supplierCode,
        },
      });

      if (!supplier) {
        throw new BadRequestException(
          `Supplier ${item.supplierCode} not found`,
        );
      }
    }

    // =====================================================
    // 4. FIND EXISTING PRODUCT
    // =====================================================

    let product = await manager.findOne(Product, {
      where: {
        code: item.productCode,
      },
    });

    // =====================================================
    // 5. UPDATE EXISTING PRODUCT
    // =====================================================

    if (product) {
      product.name = item.productName;
      product.image = item.productImage;
      product.description = item.description;

      product.categoryId = category.id;
      product.brandId = brand?.id ?? null;
      product.supplierId = supplier?.id ?? null;

      product.hasVariants = item.hasVariants;
      product.unit = item.unit;

      product.sku = item.productSku;
      product.barcode = item.productBarcode;

      product.costPrice = item.productCostPrice ?? 0;
      product.sellingPrice = item.productSellingPrice ?? 0;

      product.minimumStock = item.minimumStock ?? 0;
      product.maximumStock = item.maximumStock;

      product.isActive = true;

      return manager.save(Product, product);
    }

    // =====================================================
    // 6. CREATE NEW PRODUCT
    // =====================================================

    let barcode = item.productBarcode;
    if (!barcode || (typeof barcode === 'string' && !barcode.trim())) {
      barcode = await this.barcodesService.generateUniqueBarcode();
    }

    product = manager.create(Product, {
      code: item.productCode,
      name: item.productName,
      image: item.productImage,
      description: item.description,

      categoryId: category.id,
      brandId: brand?.id ?? null,
      supplierId: supplier?.id ?? null,

      hasVariants: item.hasVariants,
      unit: item.unit,

      sku: item.productSku,
      barcode,

      costPrice: item.productCostPrice ?? 0,
      sellingPrice: item.productSellingPrice ?? 0,

      minimumStock: item.minimumStock ?? 0,
      maximumStock: item.maximumStock,

      isActive: true,
    });

    return manager.save(Product, product);
  }
  private async createProductVariantsFromRequest(
    manager: EntityManager,
    request: Request,
    product: Product,
  ): Promise<ProductVariant[]> {
    const variantItems =
      request.items?.filter((item) => item.variantCode !== null) ?? [];

    if (variantItems.length === 0) {
      return [];
    }

    const variants: ProductVariant[] = [];

    for (const item of variantItems) {
      let variant = await manager.findOne(ProductVariant, {
        where: {
          productId: product.id,
          code: item.variantCode!,
        },
      });

      // =====================================================
      // UPDATE EXISTING VARIANT
      // =====================================================

      if (variant) {
        variant.name = item.variantName ?? '';

        variant.sku = item.variantSku!;
        variant.barcode = item.variantBarcode;

        variant.attributes = item.variantAttributes;
        variant.image = item.variantImage;

        variant.costPrice = item.variantCostPrice;
        variant.sellingPrice = item.variantSellingPrice;

        variant.isActive = true;

        variants.push(await manager.save(ProductVariant, variant));

        continue;
      }

      // =====================================================
      // CREATE NEW VARIANT
      // =====================================================

      let vBarcode = item.variantBarcode;
      if (!vBarcode || (typeof vBarcode === 'string' && !vBarcode.trim())) {
        vBarcode = await this.barcodesService.generateUniqueBarcode();
      }

      variant = manager.create(ProductVariant, {
        productId: product.id,

        code: item.variantCode!,
        name: item.variantName ?? '',

        sku: item.variantSku!,
        barcode: vBarcode,

        attributes: item.variantAttributes,
        image: item.variantImage,

        costPrice: item.variantCostPrice,
        sellingPrice: item.variantSellingPrice,

        isActive: true,
      });

      variants.push(await manager.save(ProductVariant, variant));
    }

    return variants;
  }
  private async createStocksFromRequest(
    manager: EntityManager,
    request: Request,
    product: Product,
    variants: ProductVariant[],
  ): Promise<Stock[]> {
    const stockItems =
      request.items?.filter((item) => item.warehouseCode !== null) ?? [];

    if (stockItems.length === 0) {
      return [];
    }

    const stocks: Stock[] = [];

    for (const item of stockItems) {
      // =====================================================
      // 1. VALIDATE QUANTITY
      // =====================================================

      if (item.quantity === null || item.quantity === undefined) {
        throw new BadRequestException(
          `Quantity is required for warehouse ${item.warehouseCode}`,
        );
      }

      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity)) {
        throw new BadRequestException(`Invalid quantity: ${item.quantity}`);
      }

      if (quantity <= 0) {
        throw new BadRequestException(`Quantity must be greater than 0`);
      }

      // =====================================================
      // 2. FIND WAREHOUSE
      // =====================================================
      const [warehouse] = await Promise.all([
        manager.findOne(Warehouse, {
          where: {
            code: item.warehouseCode!,
            isActive: true,
          },
        }),
      ]);

      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse ${item.warehouseCode} not found or inactive`,
        );
      }

      // =====================================================
      // 3. FIND VARIANT
      // =====================================================

      let variant: ProductVariant | null = null;

      if (item.variantCode) {
        variant = variants.find((v) => v.code === item.variantCode) ?? null;

        if (!variant) {
          throw new BadRequestException(
            `Product variant ${item.variantCode} not found`,
          );
        }
      }

      // =====================================================
      // 4. FIND EXISTING STOCK
      // =====================================================

      const existingStock = await manager.findOne(Stock, {
        where: {
          productId: product.id,
          variantId: variant ? variant.id : IsNull(),
          warehouseId: warehouse.id,
        },
      });

      // =====================================================
      // 5. UPDATE EXISTING STOCK
      // =====================================================

      if (existingStock) {
        existingStock.quantity = Number(existingStock.quantity) + quantity;

        stocks.push(await manager.save(Stock, existingStock));

        continue;
      }

      // =====================================================
      // 6. CREATE NEW STOCK
      // =====================================================

      const stock = manager.create(Stock, {
        productId: product.id,
        variantId: variant?.id ?? null,
        warehouseId: warehouse.id,
        quantity,
      });

      stocks.push(await manager.save(Stock, stock));
    }

    return stocks;
  }
  private async adjustStockFromRequest(
    manager: EntityManager,
    request: Request,
  ): Promise<StockAdjustment[]> {
    const items =
      request.items?.filter(
        (item) => item.warehouseCode !== null && item.quantity !== null,
      ) ?? [];

    if (items.length === 0) {
      throw new BadRequestException('Stock adjustment request has no items');
    }

    const adjustments: StockAdjustment[] = [];

    for (const item of items) {
      // =========================
      // VALIDATE ADJUSTMENT TYPE
      // =========================

      if (
        item.adjustmentType !== 'INCREASE' &&
        item.adjustmentType !== 'DECREASE'
      ) {
        throw new BadRequestException(
          `Invalid adjustment type for product ${item.productCode}`,
        );
      }

      // =========================
      // VALIDATE QUANTITY
      // =========================

      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Invalid adjustment quantity for product ${item.productCode}`,
        );
      }

      // =========================
      // VALIDATE REASON
      // =========================

      if (!item.adjustmentReason?.trim()) {
        throw new BadRequestException(
          `Adjustment reason is required for product ${item.productCode}`,
        );
      }

      // =========================
      // FIND PRODUCT
      // =========================

      const product = await manager.findOne(Product, {
        where: {
          code: item.productCode,
          isActive: true,
        },
      });

      if (!product) {
        throw new BadRequestException(
          `Product ${item.productCode} not found or inactive`,
        );
      }

      // =========================
      // FIND WAREHOUSE
      // =========================

      const warehouse = await manager.findOne(Warehouse, {
        where: {
          code: item.warehouseCode!,
          isActive: true,
        },
      });

      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse ${item.warehouseCode} not found or inactive`,
        );
      }

      // =========================
      // FIND VARIANT
      // =========================

      let variant: ProductVariant | null = null;

      if (item.variantCode) {
        variant = await manager.findOne(ProductVariant, {
          where: {
            productId: product.id,
            code: item.variantCode,
            isActive: true,
          },
        });

        if (!variant) {
          throw new BadRequestException(
            `Variant ${item.variantCode} not found for product ${item.productCode}`,
          );
        }
      }

      // =========================
      // FIND STOCK
      // =========================

      const stockWhere: FindOptionsWhere<Stock> = {
        productId: product.id,
        warehouseId: warehouse.id,
      };

      if (variant) {
        stockWhere.variantId = variant.id;
      } else {
        stockWhere.variantId = IsNull();
      }

      const stock = await manager.findOne(Stock, {
        where: stockWhere,
      });

      if (!stock) {
        throw new BadRequestException(
          `Stock not found for product ${item.productCode}` +
            `${variant ? ` variant ${item.variantCode}` : ''}` +
            ` in warehouse ${item.warehouseCode}`,
        );
      }

      // =========================
      // DECREASE VALIDATION
      // =========================

      if (
        item.adjustmentType === 'DECREASE' &&
        Number(stock.quantity) < quantity
      ) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productCode}. ` +
            `Current stock: ${stock.quantity}, ` +
            `requested decrease: ${quantity}`,
        );
      }

      // =========================
      // UPDATE STOCK
      // =========================

      if (item.adjustmentType === 'INCREASE') {
        stock.quantity = Number(stock.quantity) + quantity;
      } else {
        stock.quantity = Number(stock.quantity) - quantity;
      }

      await manager.save(Stock, stock);

      // =========================
      // CREATE HISTORY
      // =========================

      const adjustment = manager.create(StockAdjustment, {
        requestId: request.id,

        productId: product.id,

        variantId: variant?.id ?? null,

        warehouseId: warehouse.id,

        adjustmentType: item.adjustmentType,

        quantity,

        reason: item.adjustmentReason.trim(),
      });

      adjustments.push(adjustment);
    }

    return manager.save(StockAdjustment, adjustments);
  }
  private async stockInFromRequest(
    manager: EntityManager,
    request: Request,
  ): Promise<void> {
    const items =
      request.items?.filter(
        (item) => item.warehouseCode !== null && item.quantity !== null,
      ) ?? [];

    if (items.length === 0) {
      throw new BadRequestException('No stock items found');
    }

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Invalid quantity for product ${item.productCode}`,
        );
      }

      // Find product
      const product = await manager.findOne(Product, {
        where: {
          code: item.productCode,
          isActive: true,
        },
      });

      if (!product) {
        throw new BadRequestException(
          `Product ${item.productCode} not found or inactive`,
        );
      }

      // Find warehouse
      const warehouse = await manager.findOne(Warehouse, {
        where: {
          code: item.warehouseCode!,
          isActive: true,
        },
      });

      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse ${item.warehouseCode} not found or inactive`,
        );
      }

      // Find variant if provided
      let variant: ProductVariant | null = null;

      if (item.variantCode) {
        variant = await manager.findOne(ProductVariant, {
          where: {
            code: item.variantCode,
            productId: product.id,
            isActive: true,
          },
        });

        if (!variant) {
          throw new BadRequestException(
            `Variant ${item.variantCode} not found for product ${item.productCode}`,
          );
        }
      }

      // Find stock
      let stock = await manager.findOne(Stock, {
        where: {
          productId: product.id,
          variantId: variant ? variant.id : IsNull(),
          warehouseId: warehouse.id,
        },
      });

      // If stock doesn't exist, create it
      if (!stock) {
        stock = manager.create(Stock, {
          productId: product.id,
          variantId: variant?.id ?? null,
          warehouseId: warehouse.id,
          quantity,
        });
      } else {
        // Add stock
        stock.quantity = Number(stock.quantity) + quantity;
      }

      await manager.save(Stock, stock);
    }
  }
  private async stockOutFromRequest(
    manager: EntityManager,
    request: Request,
  ): Promise<void> {
    const items =
      request.items?.filter(
        (item) => item.warehouseCode !== null && item.quantity !== null,
      ) ?? [];

    if (items.length === 0) {
      throw new BadRequestException('No stock items found');
    }

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Invalid quantity for product ${item.productCode}`,
        );
      }

      // Find product
      const product = await manager.findOne(Product, {
        where: {
          code: item.productCode,
          isActive: true,
        },
      });

      if (!product) {
        throw new BadRequestException(
          `Product ${item.productCode} not found or inactive`,
        );
      }

      // Find warehouse
      const warehouse = await manager.findOne(Warehouse, {
        where: {
          code: item.warehouseCode!,
          isActive: true,
        },
      });

      if (!warehouse) {
        throw new BadRequestException(
          `Warehouse ${item.warehouseCode} not found or inactive`,
        );
      }

      // Find variant
      let variant: ProductVariant | null = null;

      if (item.variantCode) {
        variant = await manager.findOne(ProductVariant, {
          where: {
            code: item.variantCode,
            productId: product.id,
            isActive: true,
          },
        });

        if (!variant) {
          throw new BadRequestException(
            `Variant ${item.variantCode} not found for product ${item.productCode}`,
          );
        }
      }

      // Find existing stock
      const stock = await manager.findOne(Stock, {
        where: {
          productId: product.id,
          variantId: variant ? variant.id : IsNull(),
          warehouseId: warehouse.id,
        },
      });

      if (!stock) {
        throw new BadRequestException(
          `No stock found for ${item.productCode} in warehouse ${item.warehouseCode}`,
        );
      }

      const currentQuantity = Number(stock.quantity);

      // Prevent negative stock
      if (currentQuantity < quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${item.productCode}. Available: ${currentQuantity}, requested: ${quantity}`,
        );
      }

      // Remove stock
      stock.quantity = currentQuantity - quantity;

      await manager.save(Stock, stock);
    }
  }
  private async stockTransferFromRequest(
    manager: EntityManager,
    request: Request,
  ): Promise<void> {
    const items =
      request.items?.filter(
        (item) =>
          item.fromWarehouseCode !== null &&
          item.toWarehouseCode !== null &&
          item.quantity !== null,
      ) ?? [];

    if (items.length === 0) {
      throw new BadRequestException('No stock transfer items found');
    }

    for (const item of items) {
      const quantity = Number(item.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Invalid transfer quantity for product ${item.productCode}`,
        );
      }

      if (item.fromWarehouseCode === item.toWarehouseCode) {
        throw new BadRequestException(
          'From and to warehouse cannot be the same',
        );
      }

      // Find product
      const product = await manager.findOne(Product, {
        where: {
          code: item.productCode,
          isActive: true,
        },
      });

      if (!product) {
        throw new BadRequestException(
          `Product ${item.productCode} not found or inactive`,
        );
      }

      // Find source warehouse
      const fromWarehouse = await manager.findOne(Warehouse, {
        where: {
          code: item.fromWarehouseCode!,
          isActive: true,
        },
      });

      if (!fromWarehouse) {
        throw new BadRequestException(
          `Source warehouse ${item.fromWarehouseCode} not found or inactive`,
        );
      }

      // Find destination warehouse
      const toWarehouse = await manager.findOne(Warehouse, {
        where: {
          code: item.toWarehouseCode!,
          isActive: true,
        },
      });

      if (!toWarehouse) {
        throw new BadRequestException(
          `Destination warehouse ${item.toWarehouseCode} not found or inactive`,
        );
      }

      // Find variant
      let variant: ProductVariant | null = null;

      if (item.variantCode) {
        variant = await manager.findOne(ProductVariant, {
          where: {
            code: item.variantCode,
            productId: product.id,
            isActive: true,
          },
        });

        if (!variant) {
          throw new BadRequestException(
            `Variant ${item.variantCode} not found for product ${item.productCode}`,
          );
        }
      }

      // ==========================================
      // SOURCE STOCK
      // ==========================================

      const sourceStock = await manager.findOne(Stock, {
        where: {
          productId: product.id,
          variantId: variant ? variant.id : IsNull(),
          warehouseId: fromWarehouse.id,
        },
      });

      if (!sourceStock) {
        throw new BadRequestException(
          `No stock found for ${item.productCode} in warehouse ${item.fromWarehouseCode}`,
        );
      }

      const sourceQuantity = Number(sourceStock.quantity);

      if (sourceQuantity < quantity) {
        throw new BadRequestException(
          `Insufficient stock in ${item.fromWarehouseCode}. Available: ${sourceQuantity}, requested: ${quantity}`,
        );
      }

      // ==========================================
      // REMOVE FROM SOURCE
      // ==========================================

      sourceStock.quantity = sourceQuantity - quantity;

      await manager.save(Stock, sourceStock);

      // ==========================================
      // DESTINATION STOCK
      // ==========================================

      let destinationStock = await manager.findOne(Stock, {
        where: {
          productId: product.id,
          variantId: variant ? variant.id : IsNull(),
          warehouseId: toWarehouse.id,
        },
      });

      // Create destination stock if missing
      if (!destinationStock) {
        destinationStock = manager.create(Stock, {
          productId: product.id,
          variantId: variant?.id ?? null,
          warehouseId: toWarehouse.id,
          quantity,
        });
      } else {
        destinationStock.quantity =
          Number(destinationStock.quantity) + quantity;
      }

      await manager.save(Stock, destinationStock);
    }
  }
}
