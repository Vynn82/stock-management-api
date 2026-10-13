import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerOrder } from './customer-order.entity';
import { MessageSenderType, MessageType } from '../enums/customer-order-enums';

@Entity('customer_order_messages')
export class CustomerOrderMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'order_id',
    type: 'uuid',
  })
  orderId: string;

  @ManyToOne(() => CustomerOrder, (order) => order.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'order_id',
  })
  order: CustomerOrder;

  @Column({
    name: 'sender_type',
    type: 'enum',
    enum: MessageSenderType,
  })
  senderType: MessageSenderType;

  @Column({
    name: 'sender_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  senderId: string | null;

  @Column({
    name: 'sender_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  senderName: string | null;

  @Column({
    type: 'text',
  })
  message: string;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  messageType: MessageType;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata: Record<string, any> | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;
}
