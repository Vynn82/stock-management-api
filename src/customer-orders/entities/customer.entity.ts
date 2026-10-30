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
import { CustomerOrder } from './customer-order.entity';
import { CustomerTelegramAccount } from './customer-telegram-account.entity';
import { CustomerStatus } from '../enums/customer-status.enum';
import { LoyaltyTier } from '../../loyalty/entities/loyalty-tier.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'company_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  companyName: string | null;

  @Column({
    name: 'contact_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  contactName: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  phone: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  address: string | null;

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
    type: 'varchar',
    length: 20,
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @Column({
    name: 'rejection_reason',
    type: 'text',
    nullable: true,
  })
  rejectionReason: string | null;

  // Legacy nullable columns for backwards compatibility
  @Column({
    name: 'first_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  firstName: string | null;

  @Column({
    name: 'last_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastName: string | null;

  @Column({
    name: 'telegram_user_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  telegramUserId: string | null;

  @Column({
    name: 'telegram_chat_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  telegramChatId: string | null;

  @Column({
    name: 'telegram_username',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  telegramUsername: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;


  @Column({
    name: 'loyalty_tier_id',
    type: 'uuid',
    nullable: true,
  })
  loyaltyTierId: string | null;

  @ManyToOne(() => LoyaltyTier, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'loyalty_tier_id',
  })
  loyaltyTier: LoyaltyTier | null;

  @Column({
    name: 'manual_tier_override_id',
    type: 'uuid',
    nullable: true,
  })
  manualTierOverrideId: string | null;

  @ManyToOne(() => LoyaltyTier, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'manual_tier_override_id',
  })
  manualTierOverride: LoyaltyTier | null;

  @Column({
    name: 'tier_override_expiry',
    type: 'timestamp',
    nullable: true,
  })
  tierOverrideExpiry: Date | null;

  @Column({
    name: 'tier_override_notes',
    type: 'text',
    nullable: true,
  })
  tierOverrideNotes: string | null;

  @Column({
    name: 'lifetime_spending',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  lifetimeSpending: number;

  @Column({
    name: 'completed_orders_count',
    type: 'int',
    default: 0,
  })
  completedOrdersCount: number;

  @Column({
    name: 'total_quantity_purchased',
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
  })
  totalQuantityPurchased: number;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @OneToMany(() => CustomerTelegramAccount, (acc) => acc.customer, {
    cascade: true,
  })
  telegramAccounts: CustomerTelegramAccount[];

  @OneToMany(() => CustomerOrder, (order) => order.customer)
  orders: CustomerOrder[];
}
