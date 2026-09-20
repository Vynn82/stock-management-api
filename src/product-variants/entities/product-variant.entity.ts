import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Product } from '../../products/entities/product.entity';
import { Stock } from '../../stock/entities/stock.entity';

@Entity('product_variants')
export class ProductVariant {
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
  // BASIC INFORMATION
  // =========================

  @Column({
    type: 'varchar',
    length: 100,
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 200,
  })
  name: string;
  @Column({
    type: 'text',
    nullable: true,
  })
  image: string | null;

  // =========================
  // IDENTIFICATION
  // =========================

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  sku: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    nullable: true,
  })
  barcode: string | null;

  // =========================
  // ATTRIBUTES
  // =========================

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  attributes: Record<string, string> | null;

  // =========================
  // PRICING
  // =========================

  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  costPrice: number | null;

  @Column({
    name: 'selling_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  sellingPrice: number | null;

  // =========================
  // STATUS
  // =========================

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

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
  @OneToMany(() => Stock, (stock) => stock.variant)
  stocks: Stock[];
}
