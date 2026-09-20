import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Request } from './request.entity';

@Entity('request_items')
export class RequestItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // =========================
  // REQUEST
  // =========================

  @Column({
    name: 'request_id',
    type: 'uuid',
  })
  requestId: string;

  @ManyToOne(() => Request, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'request_id',
  })
  request: Request;

  // =====================================================
  // PRODUCT SNAPSHOT
  // =====================================================

  @Column({
    name: 'product_code',
    type: 'varchar',
    length: 50,
  })
  productCode: string;

  @Column({
    name: 'product_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  productName: string;

  @Column({
    name: 'product_image',
    type: 'text',
    nullable: true,
  })
  productImage: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'category_code',
    type: 'varchar',
    length: 50,
  })
  categoryCode: string;

  @Column({
    name: 'brand_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  brandCode: string | null;

  @Column({
    name: 'supplier_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  supplierCode: string | null;

  @Column({
    name: 'has_variants',
    type: 'boolean',
    default: false,
  })
  hasVariants: boolean;

  @Column({
    type: 'varchar',
    length: 30,
  })
  unit: string;

  @Column({
    name: 'product_sku',
    type: 'varchar',
    length: 100,
  })
  productSku: string;

  @Column({
    name: 'product_barcode',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  productBarcode: string | null;

  @Column({
    name: 'product_cost_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  productCostPrice: number | null;

  @Column({
    name: 'product_selling_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  productSellingPrice: number | null;

  @Column({
    name: 'minimum_stock',
    type: 'decimal',
    precision: 15,
    scale: 3,
    nullable: true,
  })
  minimumStock: number | null;

  @Column({
    name: 'maximum_stock',
    type: 'decimal',
    precision: 15,
    scale: 3,
    nullable: true,
  })
  maximumStock: number | null;

  // =====================================================
  // VARIANT SNAPSHOT
  // =====================================================

  @Column({
    name: 'variant_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  variantCode: string | null;

  @Column({
    name: 'variant_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  variantName: string | null;

  @Column({
    name: 'variant_sku',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  variantSku: string | null;

  @Column({
    name: 'variant_barcode',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  variantBarcode: string | null;

  @Column({
    name: 'variant_attributes',
    type: 'jsonb',
    nullable: true,
  })
  variantAttributes: Record<string, string> | null;

  @Column({
    name: 'variant_image',
    type: 'text',
    nullable: true,
  })
  variantImage: string | null;

  @Column({
    name: 'variant_cost_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  variantCostPrice: number | null;

  @Column({
    name: 'variant_selling_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  variantSellingPrice: number | null;

  // =====================================================
  // STOCK
  // =====================================================

  @Column({
    name: 'warehouse_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  warehouseCode: string | null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 3,
    nullable: true,
  })
  quantity: number | null;

  // =====================================================
  // STOCK TRANSFER
  // =====================================================

  @Column({
    name: 'from_warehouse_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  fromWarehouseCode: string | null;

  @Column({
    name: 'to_warehouse_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  toWarehouseCode: string | null;

  // =====================================================
  // STOCK ADJUSTMENT
  // =====================================================

  @Column({
    name: 'adjustment_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  adjustmentType: 'INCREASE' | 'DECREASE' | null;

  @Column({
    name: 'adjustment_reason',
    type: 'text',
    nullable: true,
  })
  adjustmentReason: string | null;

  // =====================================================
  // TIMESTAMPS
  // =====================================================

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
