import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { GoodsReceipt } from './goods-receipt.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

/** Why a line did not arrive complete in a delivery. */
export enum ReceiptIssueReason {
  /** Not delivered yet (may still come). */
  NOT_ARRIVED = 'NOT_ARRIVED',
  /** Arrived broken: not put into stock. */
  DAMAGED = 'DAMAGED',
  /** Arrived but is not what was ordered: not put into stock. */
  WRONG_ITEM = 'WRONG_ITEM',
}

/** What was short in one delivery, and why. Never changes the stock. */
@Entity('goods_receipt_issues')
export class GoodsReceiptIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'goods_receipt_id', type: 'uuid' })
  goodsReceiptId: string;

  @ManyToOne(() => GoodsReceipt, (receipt) => receipt.issues, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'goods_receipt_id' })
  goodsReceipt: GoodsReceipt;

  @Column({ name: 'purchase_order_item_id', type: 'uuid' })
  purchaseOrderItemId: string;

  @ManyToOne(() => PurchaseOrderItem, { nullable: false })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem: PurchaseOrderItem;

  @Column({ type: 'varchar', length: 20 })
  reason: ReceiptIssueReason;

  @Column({ type: 'decimal', precision: 15, scale: 3 })
  quantity: number;
}
