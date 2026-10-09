import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_telegram_accounts')
export class CustomerTelegramAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'customer_id',
    type: 'uuid',
  })
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.telegramAccounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'customer_id',
  })
  customer: Customer;

  @Column({
    name: 'telegram_user_id',
    type: 'varchar',
    length: 50,
    unique: true,
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
    name: 'telegram_username',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  telegramUsername: string | null;

  @Column({
    name: 'first_name',
    type: 'varchar',
    length: 100,
  })
  firstName: string;

  @Column({
    name: 'last_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastName: string | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
