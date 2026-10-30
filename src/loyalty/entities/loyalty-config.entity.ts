import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum LoyaltyDowngradePolicy {
  AUTOMATIC = 'AUTOMATIC',
  LOCK_IN = 'LOCK_IN',
  GRACE_PERIOD = 'GRACE_PERIOD',
}

export enum LoyaltyStackingPolicy {
  NO_STACKING = 'NO_STACKING',
  HIGHEST_ONLY = 'HIGHEST_ONLY',
  ALLOW_STACK = 'ALLOW_STACK',
}

@Entity('loyalty_configs')
export class LoyaltyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'is_enabled',
    type: 'boolean',
    default: true,
  })
  isEnabled: boolean;

  @Column({
    name: 'min_profit_margin_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 10.0,
  })
  minProfitMarginPercent: number;

  @Column({
    name: 'downgrade_policy',
    type: 'enum',
    enum: LoyaltyDowngradePolicy,
    default: LoyaltyDowngradePolicy.AUTOMATIC,
  })
  downgradePolicy: LoyaltyDowngradePolicy;

  @Column({
    name: 'grace_period_days',
    type: 'int',
    default: 30,
  })
  gracePeriodDays: number;

  @Column({
    name: 'stacking_policy',
    type: 'enum',
    enum: LoyaltyStackingPolicy,
    default: LoyaltyStackingPolicy.HIGHEST_ONLY,
  })
  stackingPolicy: LoyaltyStackingPolicy;

  @Column({
    name: 'excluded_product_ids',
    type: 'jsonb',
    default: () => "'[]'",
  })
  excludedProductIds: string[];

  @Column({
    name: 'excluded_category_ids',
    type: 'jsonb',
    default: () => "'[]'",
  })
  excludedCategoryIds: string[];

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}

