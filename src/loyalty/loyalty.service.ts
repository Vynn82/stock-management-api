import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { LoyaltyTier } from './entities/loyalty-tier.entity';
import {
  LoyaltyConfig,
  LoyaltyDowngradePolicy,
  LoyaltyStackingPolicy,
} from './entities/loyalty-config.entity';
import { Customer } from '../customer-orders/entities/customer.entity';
import { CustomerOrder } from '../customer-orders/entities/customer-order.entity';
import { CustomerOrderItem } from '../customer-orders/entities/customer-order-item.entity';
import {
  CustomerOrderRefund,
  RefundType,
} from '../customer-orders/entities/customer-order-refund.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../product-variants/entities/product-variant.entity';
import { Category } from '../categories/entities/category.entity';
import { CustomerOrderStatus } from '../customer-orders/enums/customer-order-status.enum';

import { CreateLoyaltyTierDto, UpdateLoyaltyTierDto } from './dto/loyalty-tier.dto';
import { UpdateLoyaltyConfigDto } from './dto/loyalty-config.dto';
import { OverrideCustomerTierDto } from './dto/customer-loyalty-override.dto';

export interface CalculatedItemDiscount {
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  quantity: number;
  originalUnitPrice: number;
  discountPercent: number;
  discountAmountPerUnit: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  isExcluded: boolean;
  isCappedByMargin: boolean;
}

export interface CalculatedOrderLoyalty {
  tierId: string | null;
  tierName: string | null;
  loyaltyDiscountPercent: number;
  subtotalAmount: number;
  loyaltyDiscountAmount: number;
  totalAmount: number;
  items: CalculatedItemDiscount[];
}

export interface ProductPurchaseSummary {
  productId: string;
  productName: string;
  productCode: string;
  categoryName?: string;
  variantId?: string | null;
  variantName?: string | null;
  image?: string | null;
  totalQuantity: number;
  totalSpending: number;
  orderCount: number;
  firstPurchasedAt: Date;
  lastPurchasedAt: Date;
}

export interface CustomerLoyaltyProfile {
  customer: {
    id: string;
    contactName: string | null;
    companyName: string | null;
    phone: string | null;
    telegramUsername: string | null;
  };
  currentTier: {
    id: string;
    name: string;
    code: string;
    tierRank: number;
    discountPercent: number;
    color: string;
    badgeIcon?: string | null;
    description?: string | null;
    isManualOverride: boolean;
    overrideExpiry?: Date | null;
    overrideNotes?: string | null;
  };
  statistics: {
    completedOrderCount: number;
    lifetimeSpending: number;
    totalQuantityPurchased: number;
    averageOrderValue: number;
    purchaseFrequencyDays: number;
    firstOrderDate: Date | null;
    latestOrderDate: Date | null;
    totalDiscountsReceived: number;
  };
  progress: {
    nextTier: {
      id: string;
      name: string;
      code: string;
      tierRank: number;
      minOrders: number;
      minSpending: number;
      discountPercent: number;
      color: string;
    } | null;
    ordersNeeded: number;
    spendingNeeded: number;
    ordersProgressPercent: number;
    spendingProgressPercent: number;
    overallProgressPercent: number;
  };
  productPurchaseHistory: ProductPurchaseSummary[];
  recentDiscountedOrders: Array<{
    id: string;
    orderNo: string;
    subtotalAmount: number;
    loyaltyDiscountAmount: number;
    totalAmount: number;
    tierName: string | null;
    completedAt: Date;
  }>;
}

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @InjectRepository(LoyaltyTier)
    private readonly tierRepo: Repository<LoyaltyTier>,

    @InjectRepository(LoyaltyConfig)
    private readonly configRepo: Repository<LoyaltyConfig>,

    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,

    @InjectRepository(CustomerOrder)
    private readonly orderRepo: Repository<CustomerOrder>,

    @InjectRepository(CustomerOrderItem)
    private readonly orderItemRepo: Repository<CustomerOrderItem>,

    @InjectRepository(CustomerOrderRefund)
    private readonly refundRepo: Repository<CustomerOrderRefund>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    private readonly dataSource: DataSource,
  ) {}

  // =========================================================================
  // 1. BUSINESS CONFIGURATION MANAGEMENT
  // =========================================================================

  async getOrCreateConfig(manager?: EntityManager): Promise<LoyaltyConfig> {
    const repo = manager ? manager.getRepository(LoyaltyConfig) : this.configRepo;
    let config = await repo.findOne({ order: { createdAt: 'ASC' } });

    if (!config) {
      config = repo.create({
        isEnabled: true,
        minProfitMarginPercent: 10.0,
        downgradePolicy: LoyaltyDowngradePolicy.AUTOMATIC,
        gracePeriodDays: 30,
        stackingPolicy: LoyaltyStackingPolicy.HIGHEST_ONLY,
        excludedProductIds: [],
        excludedCategoryIds: [],
      });
      config = await repo.save(config);
    }

    return config;
  }

  async updateConfig(dto: UpdateLoyaltyConfigDto): Promise<LoyaltyConfig> {
    const config = await this.getOrCreateConfig();

    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    if (dto.minProfitMarginPercent !== undefined) {
      config.minProfitMarginPercent = Number(dto.minProfitMarginPercent);
    }
    if (dto.downgradePolicy !== undefined) config.downgradePolicy = dto.downgradePolicy;
    if (dto.gracePeriodDays !== undefined) config.gracePeriodDays = Number(dto.gracePeriodDays);
    if (dto.stackingPolicy !== undefined) config.stackingPolicy = dto.stackingPolicy;
    if (dto.excludedProductIds !== undefined) config.excludedProductIds = dto.excludedProductIds;
    if (dto.excludedCategoryIds !== undefined) config.excludedCategoryIds = dto.excludedCategoryIds;

    return this.configRepo.save(config);
  }

  // =========================================================================
  // 2. LOYALTY TIERS MANAGEMENT
  // =========================================================================

  async getAllTiers(includeInactive = false): Promise<LoyaltyTier[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.tierRepo.find({
      where,
      order: { tierRank: 'ASC' },
    });
  }

  async getTierById(id: string): Promise<LoyaltyTier> {
    const tier = await this.tierRepo.findOne({ where: { id } });
    if (!tier) throw new NotFoundException(`Loyalty tier ${id} not found`);
    return tier;
  }

  async createTier(dto: CreateLoyaltyTierDto): Promise<LoyaltyTier> {
    const existingCode = await this.tierRepo.findOne({ where: { code: dto.code } });
    if (existingCode) {
      throw new BadRequestException(`Loyalty tier code "${dto.code}" already exists`);
    }

    const tier = this.tierRepo.create({
      ...dto,
      minSpending: Number(dto.minSpending),
      discountPercent: Number(dto.discountPercent),
    });

    return this.tierRepo.save(tier);
  }

  async updateTier(id: string, dto: UpdateLoyaltyTierDto): Promise<LoyaltyTier> {
    const tier = await this.getTierById(id);

    if (dto.code && dto.code !== tier.code) {
      const existing = await this.tierRepo.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new BadRequestException(`Loyalty tier code "${dto.code}" already exists`);
      }
      tier.code = dto.code;
    }

    if (dto.name !== undefined) tier.name = dto.name;
    if (dto.tierRank !== undefined) tier.tierRank = Number(dto.tierRank);
    if (dto.minOrders !== undefined) tier.minOrders = Number(dto.minOrders);
    if (dto.minSpending !== undefined) tier.minSpending = Number(dto.minSpending);
    if (dto.discountPercent !== undefined) tier.discountPercent = Number(dto.discountPercent);
    if (dto.color !== undefined) tier.color = dto.color;
    if (dto.badgeIcon !== undefined) tier.badgeIcon = dto.badgeIcon;
    if (dto.description !== undefined) tier.description = dto.description;
    if (dto.isActive !== undefined) tier.isActive = dto.isActive;

    return this.tierRepo.save(tier);
  }

  async deleteTier(id: string): Promise<{ success: boolean; message: string }> {
    const tier = await this.getTierById(id);

    // If customers are assigned, soft deactivate instead of deleting to prevent foreign key errors
    const customerCount = await this.customerRepo.count({
      where: [{ loyaltyTierId: id }, { manualTierOverrideId: id }],
    });

    if (customerCount > 0) {
      tier.isActive = false;
      await this.tierRepo.save(tier);
      return {
        success: true,
        message: `Tier has ${customerCount} assigned customer(s). Deactivated successfully instead of deleting.`,
      };
    }

    await this.tierRepo.remove(tier);
    return { success: true, message: 'Tier deleted successfully' };
  }

  // =========================================================================
  // 3. MANUAL TIER OVERRIDE (ADMIN ONLY)
  // =========================================================================

  async overrideCustomerTier(
    customerId: string,
    dto: OverrideCustomerTierDto,
  ): Promise<CustomerLoyaltyProfile> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException(`Customer ${customerId} not found`);

    if (dto.tierId) {
      const targetTier = await this.getTierById(dto.tierId);
      customer.manualTierOverrideId = targetTier.id;
      customer.tierOverrideNotes = dto.notes || 'Admin manual tier override';
      if (dto.expiryDays && dto.expiryDays > 0) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + Number(dto.expiryDays));
        customer.tierOverrideExpiry = expiry;
      } else {
        customer.tierOverrideExpiry = null;
      }
    } else {
      // Reset back to automatic calculation
      customer.manualTierOverrideId = null;
      customer.tierOverrideExpiry = null;
      customer.tierOverrideNotes = null;
    }

    await this.customerRepo.save(customer);
    return this.calculateCustomerLoyalty(customerId);
  }

  // =========================================================================
  // 4. DISCOUNT MANAGEMENT & PROFIT MARGIN LIMIT ENFORCEMENT
  // =========================================================================

  /**
   * Evaluates and applies loyalty discount to an order, enforcing product/category
   * exclusions and the configurable profit margin floor.
   */
  async calculateOrderLoyaltyDiscount(
    customerId: string,
    requestedItems: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
    }>,
    manager?: EntityManager,
  ): Promise<CalculatedOrderLoyalty> {
    const cRepo = manager ? manager.getRepository(Customer) : this.customerRepo;
    const pRepo = manager ? manager.getRepository(Product) : this.productRepo;
    const vRepo = manager ? manager.getRepository(ProductVariant) : this.variantRepo;

    const customer = await cRepo.findOne({
      where: { id: customerId },
      relations: { loyaltyTier: true, manualTierOverride: true },
    });

    const config = await this.getOrCreateConfig(manager);

    // If program is disabled or customer has no tier, return 0% discount
    if (!config.isEnabled || !customer) {
      return this.computeZeroDiscount(requestedItems, pRepo, vRepo);
    }

    // Determine active tier (honor non-expired manual override first)
    let activeTier: LoyaltyTier | null = null;
    if (customer.manualTierOverride) {
      const isExpired =
        customer.tierOverrideExpiry &&
        new Date(customer.tierOverrideExpiry) < new Date();
      if (!isExpired) {
        activeTier = customer.manualTierOverride;
      }
    }
    if (!activeTier && customer.loyaltyTier) {
      activeTier = customer.loyaltyTier;
    }
    if (!activeTier) {
      // Default to the base tier (rank 1)
      const baseTier = await (manager
        ? manager.getRepository(LoyaltyTier)
        : this.tierRepo
      ).findOne({
        where: { isActive: true },
        order: { tierRank: 'ASC' },
      });
      activeTier = baseTier || null;
    }

    const tierDiscountPercent = Number(activeTier?.discountPercent || 0);

    const excludedProducts = new Set(config.excludedProductIds || []);
    const excludedCategories = new Set(config.excludedCategoryIds || []);
    const minProfitMargin = Number(config.minProfitMarginPercent || 10.0);

    const calculatedItems: CalculatedItemDiscount[] = [];
    let grossSubtotal = 0;
    let totalDiscountAmount = 0;

    for (const reqItem of requestedItems) {
      const product = await pRepo.findOne({
        where: { id: reqItem.productId, isActive: true },
      });
      if (!product) {
        throw new BadRequestException(`Product ${reqItem.productId} not found`);
      }

      let variant: ProductVariant | null = null;
      if (reqItem.variantId) {
        variant = await vRepo.findOne({
          where: { id: reqItem.variantId, productId: product.id, isActive: true },
        });
      }

      // Base original price
      let originalUnitPrice = Number(product.sellingPrice);
      let costPrice = Number(product.costPrice || 0);

      if (variant && variant.sellingPrice !== null && variant.sellingPrice !== undefined) {
        originalUnitPrice = Number(variant.sellingPrice);
      }
      if (variant && variant.costPrice !== null && variant.costPrice !== undefined) {
        costPrice = Number(variant.costPrice);
      }

      const qty = Number(reqItem.quantity);
      const lineOriginalTotal = Number((originalUnitPrice * qty).toFixed(2));
      grossSubtotal += lineOriginalTotal;

      // Check Exclusions
      const isProductExcluded = excludedProducts.has(product.id);
      const isCategoryExcluded = excludedCategories.has(product.categoryId);
      const isExcluded = isProductExcluded || isCategoryExcluded;

      let effectiveDiscountPercent = 0;
      let isCappedByMargin = false;

      if (!isExcluded && tierDiscountPercent > 0) {
        effectiveDiscountPercent = tierDiscountPercent;

        // Profit-Margin Limit Enforcement:
        // Retail gross margin % = (Selling Price - Cost Price) / Selling Price * 100
        // When discounted: newMargin % = (discountedPrice - costPrice) / discountedPrice * 100
        // To guarantee newMargin >= minProfitMargin:
        // discountedPrice >= costPrice / (1 - minProfitMargin / 100)
        // maximum allowed discount % = (1 - (minSellingPrice / originalUnitPrice)) * 100
        if (costPrice > 0 && originalUnitPrice > costPrice) {
          const marginDecimal = minProfitMargin / 100;
          if (marginDecimal < 1) {
            const minAllowedDiscountedPrice = costPrice / (1 - marginDecimal);
            if (minAllowedDiscountedPrice >= originalUnitPrice) {
              // Current price is already below or at min margin, 0% discount allowed
              effectiveDiscountPercent = 0;
              isCappedByMargin = true;
            } else {
              const maxAllowedDiscountPercent = Number(
                (
                  ((originalUnitPrice - minAllowedDiscountedPrice) /
                    originalUnitPrice) *
                  100
                ).toFixed(2),
              );

              if (effectiveDiscountPercent > maxAllowedDiscountPercent) {
                effectiveDiscountPercent = Math.max(0, maxAllowedDiscountPercent);
                isCappedByMargin = true;
              }
            }
          }
        }
      }

      const discountPerUnit = Number(
        (originalUnitPrice * (effectiveDiscountPercent / 100)).toFixed(2),
      );
      const finalUnitPrice = Number((originalUnitPrice - discountPerUnit).toFixed(2));
      const lineSubtotal = Number((finalUnitPrice * qty).toFixed(2));
      const lineDiscountAmount = Number((discountPerUnit * qty).toFixed(2));

      totalDiscountAmount += lineDiscountAmount;

      calculatedItems.push({
        productId: product.id,
        variantId: variant ? variant.id : null,
        productName: product.name,
        variantName: variant ? variant.name : null,
        quantity: qty,
        originalUnitPrice,
        discountPercent: effectiveDiscountPercent,
        discountAmountPerUnit: discountPerUnit,
        unitPrice: finalUnitPrice,
        subtotal: lineSubtotal,
        discountAmount: lineDiscountAmount,
        isExcluded,
        isCappedByMargin,
      });
    }

    const finalTotalAmount = Number(
      Math.max(0, grossSubtotal - totalDiscountAmount).toFixed(2),
    );

    return {
      tierId: activeTier ? activeTier.id : null,
      tierName: activeTier ? activeTier.name : null,
      loyaltyDiscountPercent: tierDiscountPercent,
      subtotalAmount: Number(grossSubtotal.toFixed(2)),
      loyaltyDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
      totalAmount: finalTotalAmount,
      items: calculatedItems,
    };
  }

  private async computeZeroDiscount(
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
    pRepo: Repository<Product>,
    vRepo: Repository<ProductVariant>,
  ): Promise<CalculatedOrderLoyalty> {
    const calculatedItems: CalculatedItemDiscount[] = [];
    let grossSubtotal = 0;

    for (const req of items) {
      const prod = await pRepo.findOne({ where: { id: req.productId } });
      let originalUnitPrice = prod ? Number(prod.sellingPrice) : 0;
      let variantName: string | null = null;

      if (req.variantId) {
        const v = await vRepo.findOne({ where: { id: req.variantId } });
        if (v && v.sellingPrice !== null && v.sellingPrice !== undefined) {
          originalUnitPrice = Number(v.sellingPrice);
          variantName = v.name;
        }
      }

      const qty = Number(req.quantity);
      const sub = Number((originalUnitPrice * qty).toFixed(2));
      grossSubtotal += sub;

      calculatedItems.push({
        productId: req.productId,
        variantId: req.variantId || null,
        productName: prod?.name || 'Item',
        variantName,
        quantity: qty,
        originalUnitPrice,
        discountPercent: 0,
        discountAmountPerUnit: 0,
        unitPrice: originalUnitPrice,
        subtotal: sub,
        discountAmount: 0,
        isExcluded: false,
        isCappedByMargin: false,
      });
    }

    return {
      tierId: null,
      tierName: null,
      loyaltyDiscountPercent: 0,
      subtotalAmount: Number(grossSubtotal.toFixed(2)),
      loyaltyDiscountAmount: 0,
      totalAmount: Number(grossSubtotal.toFixed(2)),
      items: calculatedItems,
    };
  }

  // =========================================================================
  // 5. AUTOMATIC TIER MANAGEMENT & PURCHASE TRACKING RECALCULATION
  // =========================================================================

  /**
   * Recalculates all purchase tracking statistics and evaluates tier eligibility
   * for a customer based strictly on completed orders and refunds.
   */
  async calculateCustomerLoyalty(
    customerId: string,
    manager?: EntityManager,
  ): Promise<CustomerLoyaltyProfile> {
    const cRepo = manager ? manager.getRepository(Customer) : this.customerRepo;
    const oRepo = manager ? manager.getRepository(CustomerOrder) : this.orderRepo;
    const tRepo = manager ? manager.getRepository(LoyaltyTier) : this.tierRepo;

    const customer = await cRepo.findOne({
      where: { id: customerId },
      relations: { loyaltyTier: true, manualTierOverride: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const config = await this.getOrCreateConfig(manager);
    const allActiveTiers = await tRepo.find({
      where: { isActive: true },
      order: { tierRank: 'DESC' }, // Highest rank first: VIP -> Regular -> Returning -> New
    });

    // 1. Fetch ALL completed orders for this customer (with line items and refunds)
    const completedOrders = await oRepo.find({
      where: {
        customerId,
        status: CustomerOrderStatus.COMPLETED,
      },
      relations: { items: { product: true, variant: true }, refunds: true },
      order: { createdAt: 'ASC' },
    });

    // 2. Compute Purchase Tracking Metrics
    let completedOrderCount = 0;
    let lifetimeSpending = 0;
    let totalQuantityPurchased = 0;
    let totalDiscountsReceived = 0;

    const purchaseDates: Date[] = [];
    const productStatsMap = new Map<string, ProductPurchaseSummary>();
    const recentDiscountedOrders: CustomerLoyaltyProfile['recentDiscountedOrders'] = [];

    for (const order of completedOrders) {
      // Calculate total refunded amount for this order
      const orderRefundTotal = (order.refunds || []).reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0,
      );

      // Requirement 4: Exclude fully refunded orders completely from purchase count
      const isFullyRefunded =
        orderRefundTotal >= Number(order.totalAmount) && Number(order.totalAmount) > 0;

      if (isFullyRefunded) {
        continue;
      }

      // Order counts as 1 purchase
      completedOrderCount += 1;

      // Net spending contributed by this order
      const netOrderSpending = Math.max(
        0,
        Number(order.totalAmount) - orderRefundTotal,
      );
      lifetimeSpending += netOrderSpending;

      // Loyalty discount saved
      const loyaltyDiscount = Number(order.loyaltyDiscountAmount || 0);
      totalDiscountsReceived += loyaltyDiscount;

      if (loyaltyDiscount > 0) {
        recentDiscountedOrders.push({
          id: order.id,
          orderNo: order.orderNo,
          subtotalAmount: Number(order.subtotalAmount || order.totalAmount),
          loyaltyDiscountAmount: loyaltyDiscount,
          totalAmount: Number(order.totalAmount),
          tierName: order.loyaltyTierName || null,
          completedAt: order.paidAt || order.updatedAt || order.createdAt,
        });
      }

      const orderDate = order.paidAt || order.createdAt;
      purchaseDates.push(new Date(orderDate));

      // Process items and adjust for partial refunds
      for (const item of order.items || []) {
        const approvedQty = Number(item.approvedQuantity || item.requestedQuantity || 0);
        const refundedQty = Number(item.refundedQuantity || 0);
        const netQty = Math.max(0, approvedQty - refundedQty);

        if (netQty <= 0) continue;

        totalQuantityPurchased += netQty;

        const key = item.variantId
          ? `${item.productId}_${item.variantId}`
          : item.productId;

        const lineNetSpending = Math.max(
          0,
          Number(item.subtotal || item.unitPrice * netQty) -
            Number(item.refundedAmount || 0),
        );

        if (!productStatsMap.has(key)) {
          productStatsMap.set(key, {
            productId: item.productId,
            productName: item.product?.name || 'Product',
            productCode: item.product?.code || '',
            categoryName: item.product?.category?.name,
            variantId: item.variantId || null,
            variantName: item.variant?.name || null,
            image: item.variant?.image || item.product?.image || null,
            totalQuantity: netQty,
            totalSpending: lineNetSpending,
            orderCount: 1,
            firstPurchasedAt: new Date(orderDate),
            lastPurchasedAt: new Date(orderDate),
          });
        } else {
          const stat = productStatsMap.get(key)!;
          stat.totalQuantity += netQty;
          stat.totalSpending += lineNetSpending;
          stat.orderCount += 1;
          stat.lastPurchasedAt = new Date(orderDate);
        }
      }
    }

    // Average Order Value (AOV)
    lifetimeSpending = Number(lifetimeSpending.toFixed(2));
    const averageOrderValue =
      completedOrderCount > 0
        ? Number((lifetimeSpending / completedOrderCount).toFixed(2))
        : 0;

    // Purchase Frequency (average days between orders)
    let purchaseFrequencyDays = 0;
    const firstOrderDate = purchaseDates.length > 0 ? purchaseDates[0] : null;
    const latestOrderDate =
      purchaseDates.length > 0 ? purchaseDates[purchaseDates.length - 1] : null;

    if (purchaseDates.length >= 2 && firstOrderDate && latestOrderDate) {
      const spanMillis = latestOrderDate.getTime() - firstOrderDate.getTime();
      const spanDays = spanMillis / (1000 * 3600 * 24);
      purchaseFrequencyDays = Number(
        (spanDays / (purchaseDates.length - 1)).toFixed(1),
      );
    }

    // 3. Automatic Tier Evaluation
    // Dual criteria: BOTH order count and spending requirements must be satisfied
    let calculatedTier: LoyaltyTier | null = null;
    for (const tier of allActiveTiers) {
      if (
        completedOrderCount >= Number(tier.minOrders) &&
        lifetimeSpending >= Number(tier.minSpending)
      ) {
        calculatedTier = tier;
        break; // Tiers are ordered by tierRank DESC, so the first match is highest eligible
      }
    }

    if (!calculatedTier && allActiveTiers.length > 0) {
      // Fallback to lowest rank (e.g. New)
      calculatedTier = allActiveTiers[allActiveTiers.length - 1];
    }

    // 4. Downgrade Policy Handling
    let assignedTier: LoyaltyTier = calculatedTier || allActiveTiers[0];
    const previousTier = customer.loyaltyTier;

    if (previousTier && calculatedTier) {
      if (calculatedTier.tierRank < previousTier.tierRank) {
        // Customer qualified for a lower tier than previously held
        if (config.downgradePolicy === LoyaltyDowngradePolicy.LOCK_IN) {
          // Never downgrade
          assignedTier = previousTier;
        } else if (config.downgradePolicy === LoyaltyDowngradePolicy.GRACE_PERIOD) {
          // Check grace period window
          const graceDays = config.gracePeriodDays || 30;
          const daysSinceLastOrder = latestOrderDate
            ? (new Date().getTime() - latestOrderDate.getTime()) /
              (1000 * 3600 * 24)
            : 0;
          if (daysSinceLastOrder <= graceDays) {
            assignedTier = previousTier;
          }
        }
        // If AUTOMATIC, assignedTier remains calculatedTier
      }
    }

    // 5. Update Customer DB record
    customer.completedOrdersCount = completedOrderCount;
    customer.lifetimeSpending = lifetimeSpending;
    customer.totalQuantityPurchased = Number(totalQuantityPurchased.toFixed(3));
    customer.loyaltyTierId = assignedTier.id;

    await cRepo.save(customer);

    // 6. Check for Active Manual Tier Override in Profile View
    let isManualOverride = false;
    let effectiveProfileTier: LoyaltyTier = assignedTier;

    if (customer.manualTierOverride) {
      const isExpired =
        customer.tierOverrideExpiry &&
        new Date(customer.tierOverrideExpiry) < new Date();
      if (!isExpired) {
        isManualOverride = true;
        effectiveProfileTier = customer.manualTierOverride;
      }
    }

    // 7. Calculate Progress Towards Next Tier
    const ascendingTiers = [...allActiveTiers].sort((a, b) => a.tierRank - b.tierRank);
    const nextTier =
      ascendingTiers.find((t) => t.tierRank > effectiveProfileTier.tierRank) || null;

    let ordersNeeded = 0;
    let spendingNeeded = 0;
    let ordersProgressPercent = 100;
    let spendingProgressPercent = 100;
    let overallProgressPercent = 100;

    if (nextTier) {
      ordersNeeded = Math.max(0, Number(nextTier.minOrders) - completedOrderCount);
      spendingNeeded = Math.max(
        0,
        Number((Number(nextTier.minSpending) - lifetimeSpending).toFixed(2)),
      );

      ordersProgressPercent =
        Number(nextTier.minOrders) > 0
          ? Math.min(
              100,
              Math.round((completedOrderCount / Number(nextTier.minOrders)) * 100),
            )
          : 100;

      spendingProgressPercent =
        Number(nextTier.minSpending) > 0
          ? Math.min(
              100,
              Math.round(
                (lifetimeSpending / Number(nextTier.minSpending)) * 100,
              ),
            )
          : 100;

      overallProgressPercent = Math.min(
        ordersProgressPercent,
        spendingProgressPercent,
      );
    }

    const productPurchaseHistory = Array.from(productStatsMap.values()).sort(
      (a, b) => b.totalSpending - a.totalSpending,
    );

    return {
      customer: {
        id: customer.id,
        contactName: customer.contactName,
        companyName: customer.companyName,
        phone: customer.phone,
        telegramUsername: customer.telegramUsername,
      },
      currentTier: {
        id: effectiveProfileTier.id,
        name: effectiveProfileTier.name,
        code: effectiveProfileTier.code,
        tierRank: effectiveProfileTier.tierRank,
        discountPercent: Number(effectiveProfileTier.discountPercent),
        color: effectiveProfileTier.color,
        badgeIcon: effectiveProfileTier.badgeIcon,
        description: effectiveProfileTier.description,
        isManualOverride,
        overrideExpiry: isManualOverride ? customer.tierOverrideExpiry : null,
        overrideNotes: isManualOverride ? customer.tierOverrideNotes : null,
      },
      statistics: {
        completedOrderCount,
        lifetimeSpending,
        totalQuantityPurchased: Number(totalQuantityPurchased.toFixed(3)),
        averageOrderValue,
        purchaseFrequencyDays,
        firstOrderDate,
        latestOrderDate,
        totalDiscountsReceived: Number(totalDiscountsReceived.toFixed(2)),
      },
      progress: {
        nextTier: nextTier
          ? {
              id: nextTier.id,
              name: nextTier.name,
              code: nextTier.code,
              tierRank: nextTier.tierRank,
              minOrders: Number(nextTier.minOrders),
              minSpending: Number(nextTier.minSpending),
              discountPercent: Number(nextTier.discountPercent),
              color: nextTier.color,
            }
          : null,
        ordersNeeded,
        spendingNeeded,
        ordersProgressPercent,
        spendingProgressPercent,
        overallProgressPercent,
      },
      productPurchaseHistory,
      recentDiscountedOrders: recentDiscountedOrders.slice(0, 10),
    };
  }

  /**
   * Batch recalculation of loyalty tiers for all active customers in the system.
   */
  async recalculateAllCustomers(): Promise<{
    processed: number;
    success: boolean;
  }> {
    const customers = await this.customerRepo.find({ select: { id: true } });
    let count = 0;

    for (const c of customers) {
      try {
        await this.calculateCustomerLoyalty(c.id);
        count++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to recalculate loyalty for ${c.id}: ${msg}`);
      }
    }

    return { processed: count, success: true };
  }
}
