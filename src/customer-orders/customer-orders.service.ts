import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Customer } from './entities/customer.entity';
import { CustomerOrder } from './entities/customer-order.entity';
import { CustomerOrderItem } from './entities/customer-order-item.entity';
import { CustomerOrderMessage } from './entities/customer-order-message.entity';
import { CustomerOrderPayment } from './entities/customer-order-payment.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Stock } from '../stock/entities/stock.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { MailsService } from '../mails/mails.service';
import { TelegramBotService } from './telegram/telegram-bot.service';

import { CustomerOrderStatus } from './enums/customer-order-status.enum';
import { CustomerStatus } from './enums/customer-status.enum';
import { OrderSource } from './enums/order-source.enum';
import {
  DeliveryStatus,
  MessageSenderType,
  MessageType,
  PaymentMethod,
  PaymentStatus,
} from './enums/customer-order-enums';
import { CreateCustomerOrderDto } from './dto/create-customer-order.dto';
import { CreateStaffCustomerOrderDto } from './dto/create-staff-customer-order.dto';
import {
  AskCustomerDto,
  ConfirmQuantityDto,
  CustomerResponseDto,
  CustomerResponseType,
  RecordPaymentDto,
  RejectOrderDto,
} from './dto/customer-order-actions.dto';
import { StaffOrderQueryDto } from './dto/staff-order-query.dto';
import {
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';
import { TelegramAuthService } from './telegram/telegram-auth.service';

@Injectable()
export class CustomerOrdersService {
  private readonly logger = new Logger(CustomerOrdersService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerOrder)
    private readonly orderRepo: Repository<CustomerOrder>,
    @InjectRepository(CustomerOrderItem)
    private readonly itemRepo: Repository<CustomerOrderItem>,
    @InjectRepository(CustomerOrderMessage)
    private readonly messageRepo: Repository<CustomerOrderMessage>,
    @InjectRepository(CustomerOrderPayment)
    private readonly paymentRepo: Repository<CustomerOrderPayment>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Stock)
    private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    private readonly telegramBotService: TelegramBotService,
    private readonly telegramAuthService: TelegramAuthService,
    private readonly mailsService: MailsService,
  ) {}

  // ========================================================
  // 1. ORDER CREATION (CUSTOMER)
  // ========================================================

  /**
   * Creates a new customer order. Prices are verified and fetched from backend.
   * Customer identity is guaranteed by the authenticated token.
   */
  async createOrder(customerId: string, dto: CreateCustomerOrderDto) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId, isActive: true },
      relations: { telegramAccounts: true },
    });

    if (!customer) {
      throw new NotFoundException('Active customer account not found');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Generate unique human-readable order number: ORD-YYYYMMDD-XXXX
      const datePrefix = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNo = `ORD-${datePrefix}-${randomSuffix}`;

      // 2. Fetch official pricing and create items
      let totalAmount = 0;
      const orderItems: CustomerOrderItem[] = [];

      for (const reqItem of dto.items) {
        const product = await manager.findOne(Product, {
          where: { id: reqItem.productId, isActive: true },
        });

        if (!product) {
          throw new BadRequestException(
            `Product not found or inactive: ${reqItem.productId}`,
          );
        }

        let unitPrice = Number(product.sellingPrice);
        let variant: ProductVariant | null = null;

        if (reqItem.variantId) {
          variant = await manager.findOne(ProductVariant, {
            where: {
              id: reqItem.variantId,
              productId: product.id,
              isActive: true,
            },
          });

          if (!variant) {
            throw new BadRequestException(
              `Variant not found or inactive: ${reqItem.variantId}`,
            );
          }

          if (
            variant.sellingPrice !== null &&
            variant.sellingPrice !== undefined
          ) {
            unitPrice = Number(variant.sellingPrice);
          }
        }

        const requestedQty = Number(reqItem.quantity);
        if (requestedQty <= 0) {
          throw new BadRequestException('Quantity must be greater than zero');
        }

        const subtotal = Number((unitPrice * requestedQty).toFixed(2));
        totalAmount += subtotal;

        const orderItem = manager.create(CustomerOrderItem, {
          productId: product.id,
          variantId: variant ? variant.id : null,
          requestedQuantity: requestedQty,
          approvedQuantity: 0,
          waitingQuantity: 0,
          unitPrice,
          subtotal,
          status: 'PENDING',
        });

        orderItems.push(orderItem);
      }

      // 3. Create the order entity
      const telegramUserId = customer.telegramUserId || customer.telegramAccounts?.[0]?.telegramUserId || '';
      const telegramChatId = customer.telegramChatId || customer.telegramAccounts?.[0]?.telegramChatId || (telegramUserId || null);

      const newOrder = manager.create(CustomerOrder, {
        orderNo,
        customerId: customer.id,
        telegramUserId,
        telegramChatId,
        status: CustomerOrderStatus.PENDING_REVIEW,
        source: OrderSource.MINI_APP,
        createdByStaffId: null,
        deliveryStatus: DeliveryStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        totalAmount: Number(totalAmount.toFixed(2)),
        deliveryAddress: dto.deliveryAddress || customer.address || null,
        latitude:
          customer.latitude !== null && customer.latitude !== undefined
            ? Number(customer.latitude)
            : null,
        longitude:
          customer.longitude !== null && customer.longitude !== undefined
            ? Number(customer.longitude)
            : null,
        province: customer.province || null,
        district: customer.district || null,
        commune: customer.commune || null,
        remark: dto.remark || null,
      });

      const savedOrder = await manager.save(CustomerOrder, newOrder);

      // 4. Save items with order association
      for (const item of orderItems) {
        item.orderId = savedOrder.id;
      }
      await manager.save(CustomerOrderItem, orderItems);

      // 5. Create initial audit log message
      const initMessage = manager.create(CustomerOrderMessage, {
        orderId: savedOrder.id,
        senderType: MessageSenderType.SYSTEM,
        message: `Order #${orderNo} submitted by customer. Awaiting staff review.`,
        messageType: MessageType.STATUS_UPDATE,
      });
      await manager.save(CustomerOrderMessage, initMessage);

      // 6. Notify Customer on Telegram asynchronously
      if (savedOrder.telegramChatId) {
        this.telegramBotService
          .notifyOrderCreated(savedOrder.telegramChatId, orderNo, totalAmount)
          .catch((err) =>
            this.logger.error(
              `Failed to send order creation notification: ${err.message}`,
            ),
          );
      }

      // 7. Notify internal Staff via Mails system
      try {
        await this.mailsService.createMail({
          recipientId: customer.id,
          requestId: savedOrder.id,
          requestType: 'CUSTOMER_ORDER',
          subject: `New Customer Order #${orderNo}`,
          message: `Customer ${customer.firstName} placed order #${orderNo} ($${totalAmount.toFixed(2)}).`,
          action: 'REVIEW',
          requestUrl: `/customer-orders/${savedOrder.id}`,
        });
      } catch (err: any) {
        this.logger.debug(`Mail notification skipped: ${err?.message}`);
      }

      return this.getOrderByIdInternal(manager, savedOrder.id);
    });
  }

  /**
   * Creates a confirmed customer order initiated directly by sales staff.
   * - Validates customer is ACTIVE (no staff orders for non-active customers).
   * - Official prices fetched from backend.
   * - Immediately locks and decrements stock.
   * - Sets status = CONFIRMED, source = STAFF, createdByStaffId = staffUserId.
   * - Sends Telegram notification to customer.
   */
  async createOrderForStaff(
    staffUserId: string,
    dto: CreateStaffCustomerOrderDto,
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const customer = await this.customerRepo.findOne({
      where: { id: dto.customerId },
      relations: { telegramAccounts: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer #${dto.customerId} not found`);
    }

    if (customer.status !== CustomerStatus.ACTIVE || !customer.isActive) {
      throw new BadRequestException(
        `Cannot create order for customer with status "${customer.status}". Customer must be registered and ACTIVE.`,
      );
    }

    return this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Resolve Warehouse
      let warehouse: Warehouse | null = null;
      if (dto.warehouseCode) {
        warehouse = await manager.findOne(Warehouse, {
          where: { code: dto.warehouseCode, isActive: true },
        });
      }
      if (!warehouse) {
        warehouse = await manager.findOne(Warehouse, {
          where: { isActive: true },
          order: { createdAt: 'ASC' },
        });
      }
      if (!warehouse) {
        throw new BadRequestException(
          'No active warehouse available to fulfill stock',
        );
      }

      // 2. Generate unique order number: ORD-YYYYMMDD-XXXX
      const datePrefix = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNo = `ORD-${datePrefix}-${randomSuffix}`;

      // 3. Process items, verify official prices and reserve stock
      let totalAmount = 0;
      const orderItems: CustomerOrderItem[] = [];

      for (const reqItem of dto.items) {
        const product = await manager.findOne(Product, {
          where: { id: reqItem.productId, isActive: true },
        });

        if (!product) {
          throw new BadRequestException(
            `Product not found or inactive: ${reqItem.productId}`,
          );
        }

        let unitPrice = Number(product.sellingPrice);
        let variant: ProductVariant | null = null;

        if (reqItem.variantId) {
          variant = await manager.findOne(ProductVariant, {
            where: {
              id: reqItem.variantId,
              productId: product.id,
              isActive: true,
            },
          });

          if (!variant) {
            throw new BadRequestException(
              `Variant not found or inactive: ${reqItem.variantId}`,
            );
          }

          if (
            variant.sellingPrice !== null &&
            variant.sellingPrice !== undefined
          ) {
            unitPrice = Number(variant.sellingPrice);
          }
        }

        const requestedQty = Number(reqItem.quantity);
        if (requestedQty <= 0) {
          throw new BadRequestException('Quantity must be greater than zero');
        }

        const subtotal = Number((unitPrice * requestedQty).toFixed(2));
        totalAmount += subtotal;

        // Check & lock stock row for update
        const stockQuery = manager
          .createQueryBuilder(Stock, 'stock')
          .setLock('pessimistic_write')
          .where('stock.product_id = :productId', { productId: product.id })
          .andWhere('stock.warehouse_id = :warehouseId', {
            warehouseId: warehouse.id,
          });

        if (variant) {
          stockQuery.andWhere('stock.variant_id = :variantId', {
            variantId: variant.id,
          });
        } else {
          stockQuery.andWhere('stock.variant_id IS NULL');
        }

        const stock = await stockQuery.getOne();
        const availableQty = stock ? Number(stock.quantity) : 0;

        if (availableQty < requestedQty) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}"${variant ? ` (${variant.name})` : ''}. Available: ${availableQty}, Requested: ${requestedQty}.`,
          );
        }

        // Deduct stock immediately
        if (stock) {
          stock.quantity = availableQty - requestedQty;
          await manager.save(Stock, stock);
        }

        const orderItem = manager.create(CustomerOrderItem, {
          productId: product.id,
          variantId: variant ? variant.id : null,
          requestedQuantity: requestedQty,
          approvedQuantity: requestedQty,
          waitingQuantity: 0,
          warehouseId: warehouse.id,
          unitPrice,
          subtotal,
          status: 'CONFIRMED',
        });

        orderItems.push(orderItem);
      }

      // 4. Create Order entity
      const telegramUserId =
        customer.telegramUserId ||
        customer.telegramAccounts?.[0]?.telegramUserId ||
        '';
      const telegramChatId =
        customer.telegramChatId ||
        customer.telegramAccounts?.[0]?.telegramChatId ||
        (telegramUserId || null);

      // 4. Resolve delivery location & reverse geocode
      let deliveryAddress = dto.deliveryAddress?.trim() || null;
      let latitude =
        dto.latitude !== undefined && dto.latitude !== null
          ? Number(dto.latitude)
          : null;
      let longitude =
        dto.longitude !== undefined && dto.longitude !== null
          ? Number(dto.longitude)
          : null;
      let province = dto.province?.trim() || null;
      let district = dto.district?.trim() || null;
      let commune = dto.commune?.trim() || null;

      // If coordinates are provided by staff, reverse-geocode to complete address and administrative hierarchy
      if (
        latitude !== null &&
        longitude !== null &&
        !isNaN(latitude) &&
        !isNaN(longitude)
      ) {
        try {
          const geo = await this.telegramAuthService.reverseGeocode(
            latitude,
            longitude,
          );
          if (geo) {
            if (!deliveryAddress) {
              deliveryAddress = geo.formattedAddress;
            }
            if (!province) province = geo.province || null;
            if (!district) district = geo.district || null;
            if (!commune) commune = geo.commune || null;
          }
        } catch (err: any) {
          this.logger.warn(
            `Reverse geocoding failed for staff order coordinates [${latitude}, ${longitude}]: ${err.message}`,
          );
          if (!deliveryAddress) {
            deliveryAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          }
        }
      } else {
        // Fall back to customer's saved location if not overridden in order
        if (!deliveryAddress && customer.address) {
          deliveryAddress = customer.address;
        }
        if (
          latitude === null &&
          customer.latitude !== null &&
          customer.latitude !== undefined
        ) {
          latitude = Number(customer.latitude);
        }
        if (
          longitude === null &&
          customer.longitude !== null &&
          customer.longitude !== undefined
        ) {
          longitude = Number(customer.longitude);
        }
        if (!province && customer.province) province = customer.province;
        if (!district && customer.district) district = customer.district;
        if (!commune && customer.commune) commune = customer.commune;
      }

      const newOrder = manager.create(CustomerOrder, {
        orderNo,
        customerId: customer.id,
        telegramUserId,
        telegramChatId,
        status: CustomerOrderStatus.CONFIRMED,
        source: OrderSource.STAFF,
        createdByStaffId: staffUserId,
        deliveryStatus: DeliveryStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        totalAmount: Number(totalAmount.toFixed(2)),
        deliveryAddress,
        latitude,
        longitude,
        province,
        district,
        commune,
        remark: dto.remark?.trim() || null,
      });

      const savedOrder = await manager.save(CustomerOrder, newOrder);

      // 5. Save items
      for (const item of orderItems) {
        item.orderId = savedOrder.id;
      }
      await manager.save(CustomerOrderItem, orderItems);

      // 6. Audit message
      const initMessage = manager.create(CustomerOrderMessage, {
        orderId: savedOrder.id,
        senderType: MessageSenderType.STAFF,
        senderId: staffUserId,
        message: `Order #${orderNo} created and confirmed directly by sales staff. Stock allocated from warehouse ${warehouse.name}.`,
        messageType: MessageType.STATUS_UPDATE,
      });
      await manager.save(CustomerOrderMessage, initMessage);

      // 7. Notify customer via Telegram asynchronously
      if (savedOrder.telegramChatId) {
        this.telegramBotService
          .notifyStaffOrderCreated(
            savedOrder.telegramChatId,
            orderNo,
            totalAmount,
            orderItems.length,
            deliveryAddress,
          )
          .catch((err) =>
            this.logger.error(
              `Failed to send staff order notification: ${err.message}`,
            ),
          );
      }

      return this.getOrderByIdInternal(manager, savedOrder.id);
    });
  }

  // ========================================================
  // 2. ORDER QUERIES
  // ========================================================

  async getMyOrders(customerId: string, paginationDto?: StaffOrderQueryDto) {
    const { limit, skip } = getPaginationOptions(paginationDto);

    const query = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('items.variant', 'variant')
      .leftJoinAndSelect('order.messages', 'messages')
      .where('order.customer_id = :customerId', { customerId })
      .orderBy('order.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (paginationDto?.status) {
      query.andWhere('order.status = :status', {
        status: paginationDto.status,
      });
    }

    const [orders, total] = await query.getManyAndCount();
    return createPaginatedResult(orders, total, paginationDto);
  }

  async getCustomerOrderById(orderId: string, customerId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        customer: true,
        items: {
          product: true,
          variant: true,
          warehouse: true,
        },
        messages: true,
        payments: true,
      },
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException(
        'Access denied: You can only view your own orders',
      );
    }

    return order;
  }

  async findAllForStaff(queryDto: StaffOrderQueryDto) {
    const { limit, skip } = getPaginationOptions(queryDto);

    const query = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('customer.telegramAccounts', 'telegramAccounts')
      .leftJoinAndSelect('order.createdByStaff', 'createdByStaff')
      .leftJoinAndSelect('createdByStaff.profile', 'creatorProfile')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('items.variant', 'variant')
      .leftJoinAndSelect('items.warehouse', 'warehouse')
      .leftJoinAndSelect('order.paidReceivedBy', 'paidReceivedBy')
      .leftJoinAndSelect('paidReceivedBy.profile', 'staffProfile')
      .orderBy('order.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (queryDto.status) {
      query.andWhere('order.status = :status', { status: queryDto.status });
    }

    if (queryDto.source) {
      query.andWhere('order.source = :source', { source: queryDto.source });
    }

    if (queryDto.deliveryStatus) {
      query.andWhere('order.delivery_status = :delStatus', {
        delStatus: queryDto.deliveryStatus,
      });
    }

    if (queryDto.paymentStatus) {
      query.andWhere('order.payment_status = :payStatus', {
        payStatus: queryDto.paymentStatus,
      });
    }

    if (queryDto.customerId) {
      query.andWhere('order.customer_id = :custId', {
        custId: queryDto.customerId,
      });
    }

    if (queryDto.search) {
      const search = `%${queryDto.search.trim()}%`;
      query.andWhere(
        '(order.order_no ILIKE :search OR customer.first_name ILIKE :search OR customer.company_name ILIKE :search OR customer.telegram_username ILIKE :search)',
        { search },
      );
    }

    const [orders, total] = await query.getManyAndCount();
    return createPaginatedResult(orders, total, queryDto);
  }

  async findOneForStaff(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: {
        customer: {
          telegramAccounts: true,
        },
        createdByStaff: {
          profile: true,
        },
        items: {
          product: {
            stocks: {
              warehouse: true,
            },
          },
          variant: {
            stocks: {
              warehouse: true,
            },
          },
          warehouse: true,
        },
        messages: true,
        payments: {
          receivedBy: {
            profile: true,
          },
        },
      },
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Customer order #${orderId} not found`);
    }

    return order;
  }

  // ========================================================
  // 3. STAFF ORDER ACTIONS
  // ========================================================

  /**
   * Staff accepts the order.
   * Concurrently locks warehouse stock, confirms requested quantities,
   * decrements stock, and updates status to CONFIRMED.
   */
  async acceptOrder(orderId: string, staffId: string, warehouseCode?: string) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(CustomerOrder, {
        where: { id: orderId },
        relations: { items: true, customer: true },
      });

      if (!order) throw new NotFoundException('Order not found');

      if (
        order.status !== CustomerOrderStatus.PENDING_REVIEW &&
        order.status !== CustomerOrderStatus.WAITING_CUSTOMER
      ) {
        throw new BadRequestException(
          `Cannot accept order in status "${order.status}". Must be PENDING_REVIEW or WAITING_CUSTOMER.`,
        );
      }

      // Default or lookup warehouse
      let warehouse: Warehouse | null = null;
      if (warehouseCode) {
        warehouse = await manager.findOne(Warehouse, {
          where: { code: warehouseCode, isActive: true },
        });
      }
      if (!warehouse) {
        warehouse = await manager.findOne(Warehouse, {
          where: { isActive: true },
          order: { createdAt: 'ASC' },
        });
      }
      if (!warehouse)
        throw new BadRequestException(
          'No active warehouse available to fulfill stock',
        );

      // Check and reserve stock with row-level lock
      for (const item of order.items) {
        const requiredQty = Number(item.requestedQuantity);

        // Lock Stock row for update
        const stockQuery = manager
          .createQueryBuilder(Stock, 'stock')
          .setLock('pessimistic_write')
          .where('stock.product_id = :productId', { productId: item.productId })
          .andWhere('stock.warehouse_id = :warehouseId', {
            warehouseId: warehouse.id,
          });

        if (item.variantId) {
          stockQuery.andWhere('stock.variant_id = :variantId', {
            variantId: item.variantId,
          });
        } else {
          stockQuery.andWhere('stock.variant_id IS NULL');
        }

        const stock = await stockQuery.getOne();
        const availableQty = stock ? Number(stock.quantity) : 0;

        if (availableQty < requiredQty) {
          throw new BadRequestException(
            `Insufficient stock for item. Available: ${availableQty}, Requested: ${requiredQty}. Use "Ask Customer" or "Confirm Quantity" for partial fulfillment.`,
          );
        }

        // Deduct approved stock
        if (stock) {
          stock.quantity = availableQty - requiredQty;
          await manager.save(Stock, stock);
        }

        // Update item quantities
        item.approvedQuantity = requiredQty;
        item.waitingQuantity = 0;
        item.warehouseId = warehouse.id;
        item.status = 'CONFIRMED';
        await manager.save(CustomerOrderItem, item);
      }

      // Update order status
      order.status = CustomerOrderStatus.CONFIRMED;
      await manager.save(CustomerOrder, order);

      // Audit message
      const logMessage = manager.create(CustomerOrderMessage, {
        orderId: order.id,
        senderType: MessageSenderType.STAFF,
        senderId: staffId,
        message: 'Order accepted in full and confirmed by staff.',
        messageType: MessageType.STATUS_UPDATE,
      });
      await manager.save(CustomerOrderMessage, logMessage);

      // Telegram notification
      if (order.telegramChatId) {
        this.telegramBotService.notifyOrderConfirmed(
          order.telegramChatId,
          order.orderNo,
        );
      }

      return this.getOrderByIdInternal(manager, order.id);
    });
  }

  /**
   * Staff asks customer a question regarding partial availability.
   * Sets status to WAITING_CUSTOMER and sends interactive Telegram message.
   */
  async askCustomer(orderId: string, staffId: string, dto: AskCustomerDto) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: { customer: true, items: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    order.status = CustomerOrderStatus.WAITING_CUSTOMER;
    await this.orderRepo.save(order);

    const message = this.messageRepo.create({
      orderId: order.id,
      senderType: MessageSenderType.STAFF,
      senderId: staffId,
      message: dto.question,
      messageType: MessageType.QUESTION,
      metadata: {
        proposedQuantity: dto.proposedQuantity,
        itemId: dto.itemId,
      },
    });
    await this.messageRepo.save(message);

    // Calculate requested quantity dynamically
    let requestedQuantity = 0;
    if (dto.itemId) {
      const targetItem = order.items?.find((i) => i.id === dto.itemId);
      requestedQuantity = targetItem
        ? Number(targetItem.requestedQuantity)
        : Number(dto.proposedQuantity || 0);
    } else {
      requestedQuantity = (order.items || []).reduce(
        (sum, i) => sum + Number(i.requestedQuantity),
        0,
      );
      if (requestedQuantity === 0 && dto.proposedQuantity) {
        requestedQuantity = dto.proposedQuantity;
      }
    }

    // Send Telegram interactive button
    if (order.telegramChatId) {
      await this.telegramBotService.notifyStaffQuestion(
        order.telegramChatId,
        order.id,
        order.orderNo,
        dto.question,
        dto.proposedQuantity,
        requestedQuantity,
        dto.itemId,
      );
    }

    return order;
  }

  /**
   * Staff rejects the order.
   * Any reserved stock is released. Status set to REJECTED.
   */
  async rejectOrder(orderId: string, staffId: string, dto?: RejectOrderDto) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(CustomerOrder, {
        where: { id: orderId },
        relations: { items: true },
      });

      if (!order) throw new NotFoundException('Order not found');

      // If any approved stock was deducted, return it back to warehouse
      for (const item of order.items) {
        const approvedQty = Number(item.approvedQuantity);
        if (approvedQty > 0 && item.warehouseId) {
          const stock = await manager.findOne(Stock, {
            where: {
              productId: item.productId,
              variantId: item.variantId ? item.variantId : (null as any),
              warehouseId: item.warehouseId,
            },
          });
          if (stock) {
            stock.quantity = Number(stock.quantity) + approvedQty;
            await manager.save(Stock, stock);
          }
        }
        item.status = 'CANCELLED';
        await manager.save(CustomerOrderItem, item);
      }

      order.status = CustomerOrderStatus.REJECTED;
      await manager.save(CustomerOrder, order);

      const logMsg = manager.create(CustomerOrderMessage, {
        orderId: order.id,
        senderType: MessageSenderType.STAFF,
        senderId: staffId,
        message: `Order rejected by staff.${dto?.reason ? ` Reason: ${dto.reason}` : ''}`,
        messageType: MessageType.STATUS_UPDATE,
      });
      await manager.save(CustomerOrderMessage, logMsg);

      if (order.telegramChatId) {
        this.telegramBotService.notifyOrderRejected(
          order.telegramChatId,
          order.orderNo,
          dto?.reason,
        );
      }

      return this.getOrderByIdInternal(manager, order.id);
    });
  }

  /**
   * Staff explicitly confirms custom approved and waiting quantities.
   * Strict invariant: approvedQuantity + waitingQuantity === requestedQuantity!
   */
  async confirmCustomQuantities(
    orderId: string,
    staffId: string,
    confirmations: ConfirmQuantityDto | ConfirmQuantityDto[],
  ) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(CustomerOrder, {
        where: { id: orderId },
        relations: { items: true },
      });

      if (!order) throw new NotFoundException('Order not found');

      const confList = Array.isArray(confirmations)
        ? confirmations
        : [confirmations];

      let hasWaiting = false;
      let hasApproved = false;

      for (const conf of confList) {
        const item = order.items.find((i) => i.id === conf.itemId);
        if (!item) {
          throw new BadRequestException(
            `Order item #${conf.itemId} not found in this order`,
          );
        }

        const requested = Number(item.requestedQuantity);
        const approved = Number(conf.approvedQuantity);
        const waiting = Number(conf.waitingQuantity);

        // Rule 9: Never allow approved + waiting > requested
        if (approved + waiting > requested) {
          throw new BadRequestException(
            `Rule violation: approved (${approved}) + waiting (${waiting}) exceeds requested (${requested})`,
          );
        }

        // Deduct approved stock from warehouse
        if (approved > 0) {
          const warehouseId = conf.warehouseId || item.warehouseId;
          if (!warehouseId) {
            throw new BadRequestException(
              `Warehouse ID must be specified to approve ${approved} units for item #${item.id}`,
            );
          }

          const stockQuery = manager
            .createQueryBuilder(Stock, 'stock')
            .setLock('pessimistic_write')
            .where('stock.product_id = :pId', { pId: item.productId })
            .andWhere('stock.warehouse_id = :wId', { wId: warehouseId });

          if (item.variantId) {
            stockQuery.andWhere('stock.variant_id = :vId', {
              vId: item.variantId,
            });
          } else {
            stockQuery.andWhere('stock.variant_id IS NULL');
          }

          const stock = await stockQuery.getOne();
          const available = stock ? Number(stock.quantity) : 0;

          if (available < approved) {
            throw new BadRequestException(
              `Cannot approve ${approved} units: warehouse stock only has ${available}`,
            );
          }

          if (stock) {
            stock.quantity = available - approved;
            await manager.save(Stock, stock);
          }

          item.warehouseId = warehouseId;
          hasApproved = true;
        }

        if (waiting > 0) {
          hasWaiting = true;
        }

        item.approvedQuantity = approved;
        item.waitingQuantity = waiting;
        item.status =
          waiting > 0 && approved === 0 ? 'WAITING_STOCK' : 'CONFIRMED';
        await manager.save(CustomerOrderItem, item);
      }

      // Determine order status
      if (hasApproved) {
        order.status = CustomerOrderStatus.CONFIRMED;
      } else if (hasWaiting) {
        order.status = CustomerOrderStatus.WAITING_STOCK;
      }

      await manager.save(CustomerOrder, order);

      const auditMsg = manager.create(CustomerOrderMessage, {
        orderId: order.id,
        senderType: MessageSenderType.STAFF,
        senderId: staffId,
        message: `Quantities confirmed by staff. Status: ${order.status}`,
        messageType: MessageType.STATUS_UPDATE,
      });
      await manager.save(CustomerOrderMessage, auditMsg);

      if (order.telegramChatId) {
        if (order.status === CustomerOrderStatus.WAITING_STOCK) {
          this.telegramBotService.sendMessage(
            order.telegramChatId,
            `⏳ <b>Waiting for Stock</b>\n\nYour order #${order.orderNo} is queued. We will automatically prepare your order as soon as new stock arrives!`,
          );
        } else {
          this.telegramBotService.notifyOrderConfirmed(
            order.telegramChatId,
            order.orderNo,
          );
        }
      }

      return this.getOrderByIdInternal(manager, order.id);
    });
  }

  /**
   * Customer responds to questions or confirms partial quantities.
   */
  async handleCustomerResponse(
    orderId: string,
    customerId: string,
    dto: CustomerResponseDto,
  ) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(CustomerOrder, {
        where: { id: orderId },
        relations: { customer: true, items: true },
      });

      if (!order) throw new NotFoundException('Order not found');

      if (order.customerId !== customerId) {
        throw new ForbiddenException(
          'Access denied: You can only respond to your own orders',
        );
      }

      // Record customer message in history
      const customerMsg = manager.create(CustomerOrderMessage, {
        orderId: order.id,
        senderType: MessageSenderType.CUSTOMER,
        senderId: customerId,
        senderName: order.customer.firstName,
        message: dto.message || `Customer responded: ${dto.responseType}`,
        messageType:
          dto.responseType === CustomerResponseType.ACCEPT
            ? MessageType.RESPONSE
            : MessageType.TEXT,
      });
      await manager.save(CustomerOrderMessage, customerMsg);

      if (dto.responseType === CustomerResponseType.ACCEPT) {
        // Customer accepts proposed quantity
        const proposedQty = dto.acceptedQuantity;

        if (
          order.items.length > 0 &&
          proposedQty !== undefined &&
          proposedQty > 0
        ) {
          const item = dto.itemId
            ? order.items.find((i) => i.id === dto.itemId)
            : order.items[0];

          if (item) {
            let warehouse: Warehouse | null = null;
            if (item.warehouseId) {
              warehouse = await manager.findOne(Warehouse, {
                where: { id: item.warehouseId, isActive: true },
              });
            }

            if (!warehouse) {
              const stockWithQty = await manager
                .createQueryBuilder(Stock, 'stock')
                .where('stock.product_id = :pId', { pId: item.productId })
                .andWhere(
                  item.variantId
                    ? 'stock.variant_id = :vId'
                    : 'stock.variant_id IS NULL',
                  item.variantId ? { vId: item.variantId } : {},
                )
                .andWhere('stock.quantity > 0')
                .orderBy('stock.quantity', 'DESC')
                .getOne();

              if (stockWithQty) {
                warehouse = await manager.findOne(Warehouse, {
                  where: { id: stockWithQty.warehouseId, isActive: true },
                });
              }
            }

            if (!warehouse) {
              warehouse = await manager.findOne(Warehouse, {
                where: { isActive: true },
                order: { createdAt: 'ASC' },
              });
            }

            if (warehouse) {
              const stockQuery = manager
                .createQueryBuilder(Stock, 'stock')
                .setLock('pessimistic_write')
                .where('stock.product_id = :pId', { pId: item.productId })
                .andWhere('stock.warehouse_id = :wId', { wId: warehouse.id });

              if (item.variantId) {
                stockQuery.andWhere('stock.variant_id = :vId', {
                  vId: item.variantId,
                });
              } else {
                stockQuery.andWhere('stock.variant_id IS NULL');
              }

              const stock = await stockQuery.getOne();
              const available = stock ? Number(stock.quantity) : 0;
              const toApprove = Math.min(available, proposedQty);

              if (toApprove > 0 && stock) {
                stock.quantity = available - toApprove;
                await manager.save(Stock, stock);
              }

              item.approvedQuantity = toApprove;
              item.waitingQuantity = Number(item.requestedQuantity) - toApprove;
              item.warehouseId = warehouse.id;
              item.status =
                item.waitingQuantity > 0 && toApprove === 0
                  ? 'WAITING_STOCK'
                  : 'CONFIRMED';
              await manager.save(CustomerOrderItem, item);
            }
          }
        }

        order.status = CustomerOrderStatus.CONFIRMED;
        await manager.save(CustomerOrder, order);

        if (order.telegramChatId) {
          this.telegramBotService.notifyOrderConfirmed(
            order.telegramChatId,
            order.orderNo,
          );
        }
      } else if (dto.responseType === CustomerResponseType.REJECT) {
        order.status = CustomerOrderStatus.CANCELLED;
        await manager.save(CustomerOrder, order);

        if (order.telegramChatId) {
          this.telegramBotService.sendMessage(
            order.telegramChatId,
            `Order #${order.orderNo} has been cancelled per your request.`,
          );
        }
      } else if (dto.responseType === CustomerResponseType.WAIT_STOCK) {
        // Customer chose to wait for all requested units to arrive
        let totalRequested = 0;
        for (const item of order.items) {
          if (!dto.itemId || item.id === dto.itemId) {
            const req = Number(item.requestedQuantity);
            totalRequested += req;
            item.approvedQuantity = 0;
            item.waitingQuantity = req;
            item.status = 'WAITING_STOCK';
            await manager.save(CustomerOrderItem, item);
          }
        }

        if (totalRequested === 0) {
          totalRequested = (order.items || []).reduce(
            (sum, i) => sum + Number(i.requestedQuantity),
            0,
          );
        }

        order.status = CustomerOrderStatus.WAITING_STOCK;
        await manager.save(CustomerOrder, order);

        // Audit message in order timeline
        const waitLog = manager.create(CustomerOrderMessage, {
          orderId: order.id,
          senderType: MessageSenderType.CUSTOMER,
          senderId: customerId,
          senderName:
            order.customer?.contactName ||
            order.customer?.companyName ||
            order.customer?.firstName ||
            'Customer',
          message: `Customer chose to wait for all ${totalRequested} units. Order queued as WAITING_STOCK.`,
          messageType: MessageType.RESPONSE,
        });
        await manager.save(CustomerOrderMessage, waitLog);

        if (order.telegramChatId) {
          await this.telegramBotService.sendMessage(
            order.telegramChatId,
            `⏳ <b>Waiting for Stock</b>\n\n` +
              `You chose to wait for all ${totalRequested} units. Your order #${order.orderNo} is queued and will be fulfilled as soon as stock arrives.`,
          );
        }
      } else {
        // Free-text message or counter-offer:
        // Rule 16: Free-text must NOT directly manipulate stock or order quantity!
        // Notify staff so they can review and decide!
        try {
          await this.mailsService.createMail({
            recipientId: order.customerId,
            requestId: order.id,
            requestType: 'CUSTOMER_ORDER',
            subject: `Customer Message on Order #${order.orderNo}`,
            message: `Customer wrote: "${dto.message}"`,
            action: 'REVIEW',
            requestUrl: `/customer-orders/${order.id}`,
          });
        } catch (err: any) {
          this.logger.debug(`Staff mail notification skipped: ${err?.message}`);
        }

        if (order.telegramChatId) {
          this.telegramBotService.sendMessage(
            order.telegramChatId,
            `💬 Message received! Our staff will review your message shortly.`,
          );
        }
      }

      return this.getOrderByIdInternal(manager, order.id);
    });
  }

  // ========================================================
  // 4. ORDER FULFILLMENT & LIFECYCLE
  // ========================================================

  async processOrder(orderId: string, staffId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== CustomerOrderStatus.CONFIRMED) {
      throw new BadRequestException(
        'Order must be CONFIRMED before processing',
      );
    }

    order.status = CustomerOrderStatus.PROCESSING;
    await this.orderRepo.save(order);

    await this.logStatusChange(
      order.id,
      staffId,
      'Order is now PROCESSING for delivery.',
    );

    if (order.telegramChatId) {
      this.telegramBotService.notifyOrderProcessing(
        order.telegramChatId,
        order.orderNo,
      );
    }

    return order;
  }

  async outForDelivery(orderId: string, staffId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    order.status = CustomerOrderStatus.OUT_FOR_DELIVERY;
    order.deliveryStatus = DeliveryStatus.OUT_FOR_DELIVERY;
    await this.orderRepo.save(order);

    await this.logStatusChange(order.id, staffId, 'Order is OUT FOR DELIVERY.');

    if (order.telegramChatId) {
      this.telegramBotService.notifyOutForDelivery(
        order.telegramChatId,
        order.orderNo,
        order.deliveryAddress,
      );
    }

    return order;
  }

  async markDelivered(orderId: string, staffId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    order.deliveryStatus = DeliveryStatus.DELIVERED;
    // Order status is DELIVERED, but not COMPLETED until cash payment is recorded!
    order.status = CustomerOrderStatus.DELIVERED;
    await this.orderRepo.save(order);

    await this.logStatusChange(
      order.id,
      staffId,
      'Order marked as DELIVERED. Cash payment pending collection.',
    );

    if (order.telegramChatId) {
      this.telegramBotService.notifyOrderDelivered(
        order.telegramChatId,
        order.orderNo,
        Number(order.totalAmount),
      );
    }

    return order;
  }

  // ========================================================
  // 5. CASH PAYMENT (PHYSICAL CASH ONLY)
  // ========================================================

  async recordCashPayment(
    orderId: string,
    staffId: string,
    dto: RecordPaymentDto,
  ) {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const order = await manager.findOne(CustomerOrder, {
        where: { id: orderId },
      });

      if (!order) throw new NotFoundException('Order not found');

      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('Order is already marked as PAID');
      }

      const payment = manager.create(CustomerOrderPayment, {
        orderId: order.id,
        amount: dto.amount,
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        receivedById: staffId,
        receivedAt: new Date(),
        remark: dto.remark || 'Cash received by delivery staff',
      });
      await manager.save(CustomerOrderPayment, payment);

      order.paymentStatus = PaymentStatus.PAID;
      order.paymentMethod = PaymentMethod.CASH;
      order.paidAt = new Date();
      order.paidReceivedById = staffId;

      // If delivery is also DELIVERED, automatically mark as COMPLETED
      if (order.deliveryStatus === DeliveryStatus.DELIVERED) {
        order.status = CustomerOrderStatus.COMPLETED;
      }

      await manager.save(CustomerOrderOrderOrAny(order));

      const logMsg = manager.create(CustomerOrderMessage, {
        orderId: order.id,
        senderType: MessageSenderType.STAFF,
        senderId: staffId,
        message: `Cash payment of $${Number(dto.amount).toFixed(2)} recorded by staff. Status: PAID.`,
        messageType: MessageType.STATUS_UPDATE,
      });
      await manager.save(CustomerOrderMessage, logMsg);

      if (order.telegramChatId) {
        this.telegramBotService.notifyPaymentReceived(
          order.telegramChatId,
          order.orderNo,
          Number(dto.amount),
          'Staff',
        );

        if (order.status === CustomerOrderStatus.COMPLETED) {
          this.telegramBotService.notifyOrderCompleted(
            order.telegramChatId,
            order.orderNo,
          );
        }
      }

      return this.getOrderByIdInternal(manager, order.id);
    });
  }

  async completeOrder(orderId: string, staffId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.deliveryStatus !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot complete order: Delivery status is not DELIVERED',
      );
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'Cannot complete order: Cash payment has not been recorded',
      );
    }

    order.status = CustomerOrderStatus.COMPLETED;
    await this.orderRepo.save(order);

    await this.logStatusChange(
      order.id,
      staffId,
      'Order officially COMPLETED and closed.',
    );

    if (order.telegramChatId) {
      this.telegramBotService.notifyOrderCompleted(
        order.telegramChatId,
        order.orderNo,
      );
    }

    return order;
  }

  // ========================================================
  // 6. WAITING STOCK ALLOCATION ENGINE
  // ========================================================

  /**
   * Deterministic FIFO allocation for waiting stock.
   * Triggered when new stock arrives in the system (STOCK_IN or direct adjustment).
   */
  async allocateWaitingStock(
    manager: EntityManager,
    productId: string,
    variantId: string | null,
    warehouseId: string,
    availableQuantityToAdd: number,
  ): Promise<number> {
    if (availableQuantityToAdd <= 0) return 0;

    let remainingStockToAllocate = availableQuantityToAdd;

    // Find all waiting items ordered strictly by oldest order first
    const itemQuery = manager
      .createQueryBuilder(CustomerOrderItem, 'item')
      .innerJoinAndSelect('item.order', 'order')
      .where('item.product_id = :productId', { productId })
      .andWhere('item.waiting_quantity > 0')
      .andWhere('order.status IN (:...statuses)', {
        statuses: [
          CustomerOrderStatus.WAITING_STOCK,
          CustomerOrderStatus.WAITING_CUSTOMER,
          CustomerOrderStatus.PENDING_REVIEW,
        ],
      })
      .orderBy('order.created_at', 'ASC')
      .addOrderBy('item.created_at', 'ASC');

    if (variantId) {
      itemQuery.andWhere('item.variant_id = :variantId', { variantId });
    } else {
      itemQuery.andWhere('item.variant_id IS NULL');
    }

    const waitingItems = await itemQuery.getMany();

    for (const item of waitingItems) {
      if (remainingStockToAllocate <= 0) break;

      const waitingQty = Number(item.waitingQuantity);
      const allocateQty = Math.min(waitingQty, remainingStockToAllocate);

      item.approvedQuantity = Number(item.approvedQuantity) + allocateQty;
      item.waitingQuantity = waitingQty - allocateQty;
      item.warehouseId = warehouseId;

      if (item.waitingQuantity === 0) {
        item.status = 'CONFIRMED';
      }

      await manager.save(CustomerOrderItem, item);
      remainingStockToAllocate -= allocateQty;

      // Check if the whole order is now fully fulfilled
      const allOrderItems = await manager.find(CustomerOrderItem, {
        where: { orderId: item.order.id },
      });

      const stillHasWaiting = allOrderItems.some(
        (i) => Number(i.waitingQuantity) > 0,
      );

      if (
        !stillHasWaiting &&
        item.order.status === CustomerOrderStatus.WAITING_STOCK
      ) {
        item.order.status = CustomerOrderStatus.CONFIRMED;
        await manager.save(CustomerOrder, item.order);

        // Notify customer on Telegram
        if (item.order.telegramChatId) {
          const product = await manager.findOne(Product, {
            where: { id: productId },
          });
          const productName = product?.name || 'Your item';
          this.telegramBotService.notifyStockAllocated(
            item.order.telegramChatId,
            item.order.orderNo,
            productName,
            allocateQty,
          );
        }
      }
    }

    return availableQuantityToAdd - remainingStockToAllocate;
  }

  // ========================================================
  // HELPERS
  // ========================================================

  private async getOrderByIdInternal(manager: EntityManager, orderId: string) {
    return manager.findOne(CustomerOrder, {
      where: { id: orderId },
      relations: {
        customer: true,
        createdByStaff: true,
        items: {
          product: true,
          variant: true,
          warehouse: true,
        },
        messages: true,
        payments: true,
      },
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });
  }

  private async logStatusChange(
    orderId: string,
    staffId: string,
    message: string,
  ) {
    const log = this.messageRepo.create({
      orderId,
      senderType: MessageSenderType.STAFF,
      senderId: staffId,
      message,
      messageType: MessageType.STATUS_UPDATE,
    });
    await this.messageRepo.save(log);
  }
}

function CustomerOrderOrderOrAny(order: CustomerOrder): any {
  return order;
}
