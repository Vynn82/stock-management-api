import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../customer-orders/entities/customer.entity';

@Entity('loyalty_tiers')
export class LoyaltyTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  name: string; // e.g. "New", "Returning", "Regular", "VIP"

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  code: string; // e.g. "NEW", "RETURNING", "REGULAR", "VIP"

  @Column({
    name: 'tier_rank',
    type: 'int',
    default: 1,
  })
  tierRank: number; // 1 (New) -> 2 (Returning) -> 3 (Regular) -> 4 (VIP)

  @Column({
    name: 'min_orders',
    type: 'int',
    default: 0,
  })
  minOrders: number; // 0, 2, 5, 10

  @Column({
    name: 'min_spending',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  minSpending: number; // 0.00, 2000.00, 7500.00, 15000.00

  @Column({
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  discountPercent: number; // 0.00, 2.00, 3.00, 5.00

  @Column({
    type: 'varchar',
    length: 50,
    default: '#64748B',
  })
  color: string;

  @Column({
    name: 'badge_icon',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  badgeIcon: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;

  @OneToMany(() => Customer, (customer) => customer.loyaltyTier)
  customers: Customer[];
}

