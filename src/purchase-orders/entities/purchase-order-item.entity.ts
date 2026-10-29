import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Brand } from '../../brands/entities/brand.entity';
import { Category } from '../../categories/entities/category.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';
import { PurchaseOrder } from './purchase-order.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  /**
   * The catalogue product. Null for a "new product" line: the product does
   * not exist yet and is created when its goods are received (see the
   * newProduct* columns), after which this points to it.
   */
  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  // ---- New-product line (productId is null until the goods arrive) ----
  @Column({ name: 'new_product_name', type: 'varchar', length: 200, nullable: true })
  newProductName: string | null;

  @Column({ name: 'new_product_category_id', type: 'uuid', nullable: true })
  newProductCategoryId: string | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'new_product_category_id' })
  newProductCategory: Category | null;

  /** Optional brand of the new product. */
  @Column({ name: 'new_product_brand_id', type: 'uuid', nullable: true })
  newProductBrandId: string | null;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'new_product_brand_id' })
  newProductBrand: Brand | null;

  @Column({ name: 'new_product_unit', type: 'varchar', length: 30, nullable: true })
  newProductUnit: string | null;

  /** Optional: when empty, a SKU is generated and the business team can change it later. */
  @Column({ name: 'new_product_sku', type: 'varchar', length: 100, nullable: true })
  newProductSku: string | null;

  /**
   * Only used by orders received while new products were NOT added
   * automatically: the manager added them by hand and marked the line.
   * New receipts create the product themselves, so this stays empty.
   */
  @Column({ name: 'catalog_added_at', type: 'timestamp', nullable: true })
  catalogAddedAt: Date | null;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId: string | null;

  @ManyToOne(() => ProductVariant, { nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;

  /** How much of [quantity] has arrived so far (the sum of all receipts). */
  @Column({
    name: 'received_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  receivedQuantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: number;

  @Column({ name: 'line_total', type: 'decimal', precision: 15, scale: 2 })
  lineTotal: number;
}
