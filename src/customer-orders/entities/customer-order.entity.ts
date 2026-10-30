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
import { Customer } from './customer.entity';
import { CustomerOrderItem } from './customer-order-item.entity';
import { CustomerOrderMessage } from './customer-order-message.entity';
import { CustomerOrderPayment } from './customer-order-payment.entity';
import { CustomerOrderRefund } from './customer-order-refund.entity';
import { User } from '../../users/entities/user.entity';
import { CustomerOrderStatus } from '../enums/customer-order-status.enum';
import { OrderSource } from '../enums/order-source.enum';
import {
  DeliveryStatus,
  PaymentMethod,
  PaymentStatus,
} from '../enums/customer-order-enums';

@Entity('customer_orders')
export class CustomerOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'order_no',
    type: 'varchar',
    length: 50,
    unique: true,
  })
  orderNo: string;

  @Column({
    name: 'customer_id',
    type: 'uuid',
  })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.orders, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'customer_id',
  })
  customer: Customer;

  @Column({
    name: 'telegram_user_id',
    type: 'varchar',
    length: 50,
  })
  telegramUserId: string;

  @Column({
    name: 'telegram_chat_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  telegramChatId: string | null;

  @Column({
    type: 'enum',
    enum: CustomerOrderStatus,
    default: CustomerOrderStatus.PENDING_REVIEW,
  })
  status: CustomerOrderStatus;

  @Column({
    type: 'varchar',
    length: 30,
    default: OrderSource.MINI_APP,
  })
  source: OrderSource;

  @Column({
    name: 'created_by_staff_id',
    type: 'uuid',
    nullable: true,
  })
  createdByStaffId: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'created_by_staff_id',
  })
  createdByStaff: User | null;

  @Column({
    name: 'delivery_status',
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  deliveryStatus: DeliveryStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({
    name: 'paid_at',
    type: 'timestamp',
    nullable: true,
  })
  paidAt: Date | null;

  @Column({
    name: 'paid_received_by_id',
    type: 'uuid',
    nullable: true,
  })
  paidReceivedById: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'paid_received_by_id',
  })
  paidReceivedBy: User | null;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalAmount: number;

  @Column({
    name: 'delivery_address',
    type: 'text',
    nullable: true,
  })
  deliveryAddress: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude: number | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  province: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  district: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  commune: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  remark: string | null;

  @Column({
    name: 'staff_notes',
    type: 'text',
    nullable: true,
  })
  staffNotes: string | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;


  @Column({
    name: 'subtotal_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  subtotalAmount: number;

  @Column({
    name: 'loyalty_discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  loyaltyDiscountPercent: number;

  @Column({
    name: 'loyalty_discount_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  loyaltyDiscountAmount: number;

  @Column({
    name: 'loyalty_tier_id',
    type: 'uuid',
    nullable: true,
  })
  loyaltyTierId: string | null;

  @Column({
    name: 'loyalty_tier_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  loyaltyTierName: string | null;

  @Column({
    name: 'refunded_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  refundedAmount: number;

  @OneToMany(() => CustomerOrderRefund, (refund) => refund.order, {
    cascade: true,
  })
  refunds: CustomerOrderRefund[];

  @OneToMany(() => CustomerOrderItem, (item) => item.order, {
    cascade: true,
  })
  items: CustomerOrderItem[];

  @OneToMany(() => CustomerOrderMessage, (message) => message.order, {
    cascade: true,
  })
  messages: CustomerOrderMessage[];

  @OneToMany(() => CustomerOrderPayment, (payment) => payment.order, {
    cascade: true,
  })
  payments: CustomerOrderPayment[];
}
