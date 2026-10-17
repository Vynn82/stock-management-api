import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomerOrder } from './customer-order.entity';
import { CustomerTelegramAccount } from './customer-telegram-account.entity';
import { CustomerStatus } from '../enums/customer-status.enum';

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
