import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';
import { Request } from '../../requests/entities/request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('stock_adjustments')
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // =========================
  // REQUEST
  // =========================

  @Column({
    name: 'request_id',
    type: 'uuid',
    nullable: true,
  })
  requestId: string | null;

  @ManyToOne(() => Request, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'request_id',
  })
  request: Request | null;

  // =========================
  // ADJUSTED BY
  // =========================

  @Column({
    name: 'adjusted_by_id',
    type: 'uuid',
    nullable: true,
  })
  adjustedById: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'adjusted_by_id',
  })
  adjustedBy: User | null;

  // =========================
  // PRODUCT
  // =========================

  @Column({
    name: 'product_id',
    type: 'uuid',
  })
  productId: string;

  @ManyToOne(() => Product, {
    nullable: false,
  })
  @JoinColumn({
    name: 'product_id',
  })
  product: Product;

  // =========================
  // VARIANT
  // =========================

  @Column({
    name: 'variant_id',
    type: 'uuid',
    nullable: true,
  })
  variantId: string | null;

  @ManyToOne(() => ProductVariant, {
    nullable: true,
  })
  @JoinColumn({
    name: 'variant_id',
  })
  variant: ProductVariant | null;

  // =========================
  // WAREHOUSE
  // =========================

  @Column({
    name: 'warehouse_id',
    type: 'uuid',
  })
  warehouseId: string;

  @ManyToOne(() => Warehouse, {
    nullable: false,
  })
  @JoinColumn({
    name: 'warehouse_id',
  })
  warehouse: Warehouse;

  // =========================
  // ADJUSTMENT
  // =========================

  @Column({
    name: 'adjustment_type',
    type: 'varchar',
    length: 20,
  })
  adjustmentType: 'INCREASE' | 'DECREASE';

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 3,
  })
  quantity: number;

  // =========================
  // REASON
  // =========================

  @Column({
    type: 'text',
  })
  reason: string;

  // =========================
  // TIMESTAMP
  // =========================

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;
}
