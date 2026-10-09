import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerOrder } from './customer-order.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../product-variants/entities/product-variant.entity';
import { Warehouse } from '../../warehouses/entities/warehouse.entity';

@Entity('customer_order_items')
export class CustomerOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'order_id',
    type: 'uuid',
  })
  orderId: string;

  @ManyToOne(() => CustomerOrder, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'order_id',
  })
  order: CustomerOrder;

  @Column({
    name: 'product_id',
    type: 'uuid',
  })
  productId: string;

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'product_id',
  })
  product: Product;

  @Column({
    name: 'variant_id',
    type: 'uuid',
    nullable: true,
  })
  variantId: string | null;

  @ManyToOne(() => ProductVariant, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'variant_id',
  })
  variant: ProductVariant | null;

  @Column({
    name: 'warehouse_id',
    type: 'uuid',
    nullable: true,
  })
  warehouseId: string | null;

  @ManyToOne(() => Warehouse, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'warehouse_id',
  })
  warehouse: Warehouse | null;

  @Column({
    name: 'requested_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
  })
  requestedQuantity: number;

  @Column({
    name: 'approved_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  approvedQuantity: number;

  @Column({
    name: 'waiting_quantity',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  waitingQuantity: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  unitPrice: number;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  subtotal: number;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'PENDING',
  })
  status: string;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
