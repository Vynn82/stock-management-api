import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('stocks')
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_id',
  })
  product: Product;

  // =========================
  // PRODUCT VARIANT
  // =========================

  @Column({
    name: 'variant_id',
    type: 'uuid',
    nullable: true,
  })
  variantId: string | null;

  @ManyToOne(() => ProductVariant, {
    nullable: true,
    onDelete: 'CASCADE',
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
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'warehouse_id',
  })
  warehouse: Warehouse;

  // =========================
  // QUANTITY
  // =========================

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  quantity: number;

  // =========================
  // TIMESTAMPS
  // =========================

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
