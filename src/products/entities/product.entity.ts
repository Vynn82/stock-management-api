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

import { Category } from '../../categories/entities/category.entity';
import { Brand } from '../../brands/entities/brand.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';
import { Stock } from '../../stock/entities/stock.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // =========================
  // BASIC INFORMATION
  // =========================

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
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

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  // =========================
  // MASTER DATA
  // =========================

  @Column({
    name: 'category_id',
    type: 'uuid',
  })
  categoryId: string;

  @ManyToOne(() => Category, {
    nullable: false,
  })
  @JoinColumn({
    name: 'category_id',
  })
  category: Category;

  @Column({
    name: 'brand_id',
    type: 'uuid',
    nullable: true,
  })
  brandId: string | null;

  @ManyToOne(() => Brand, {
    nullable: true,
  })
  @JoinColumn({
    name: 'brand_id',
  })
  brand: Brand | null;

  @Column({
    name: 'supplier_id',
    type: 'uuid',
    nullable: true,
  })
  supplierId: string | null;

  @ManyToOne(() => Supplier, {
    nullable: true,
  })
  @JoinColumn({
    name: 'supplier_id',
  })
  supplier: Supplier | null;

  // =========================
  // VARIANT
  // =========================

  @Column({
    name: 'has_variants',
    type: 'boolean',
    default: false,
  })
  hasVariants: boolean;

  // =========================
  // IDENTIFICATION
  // =========================

  @Column({
    type: 'varchar',
    length: 30,
  })
  unit: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    nullable: true,
  })
  barcode: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  sku: string;

  // =========================
  // PRICING
  // =========================

  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  costPrice: number;

  @Column({
    name: 'selling_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  sellingPrice: number;

  // =========================
  // STOCK RULES
  // =========================

  @Column({
    name: 'minimum_stock',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  minimumStock: number;

  @Column({
    name: 'maximum_stock',
    type: 'decimal',
    precision: 15,
    scale: 3,
    nullable: true,
  })
  maximumStock: number | null;

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

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => Stock, (stock) => stock.product)
  stocks: Stock[];
}
