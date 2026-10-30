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
import { User } from '../../users/entities/user.entity';

export enum RefundType {
  PARTIAL = 'PARTIAL',
  FULL = 'FULL',
}

export interface RefundedItemDetail {
  orderItemId: string;
  productId: string;
  productName?: string;
  variantId?: string | null;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

@Entity('customer_order_refunds')
export class CustomerOrderRefund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'refund_no',
    type: 'varchar',
    length: 50,
    unique: true,
  })
  refundNo: string;

  @Column({
    name: 'order_id',
    type: 'uuid',
  })
  orderId: string;

  @ManyToOne(() => CustomerOrder, (order) => order.refunds, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'order_id',
  })
  order: CustomerOrder;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
  })
  amount: number;

  @Column({
    name: 'refund_type',
    type: 'enum',
    enum: RefundType,
    default: RefundType.PARTIAL,
  })
  refundType: RefundType;

  @Column({
    type: 'text',
    nullable: true,
  })
  reason: string | null;

  @Column({
    name: 'processed_by_id',
    type: 'uuid',
    nullable: true,
  })
  processedById: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'processed_by_id',
  })
  processedBy: User | null;

  @Column({
    type: 'jsonb',
    default: () => "'[]'",
  })
  items: RefundedItemDetail[];

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}

