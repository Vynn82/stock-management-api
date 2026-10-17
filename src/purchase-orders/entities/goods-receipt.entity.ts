import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';

/** One delivery against a purchase order. A PO can have several. */
@Entity('goods_receipts')
export class GoodsReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'receipt_number',
    type: 'varchar',
    length: 30,
    unique: true,
  })
  receiptNumber: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.receipts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'received_by_id', type: 'uuid' })
  receivedById: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => GoodsReceiptItem, (item) => item.goodsReceipt)
  items: GoodsReceiptItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
