import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Request } from './request.entity';
import { User } from '../../users/entities/user.entity';

export enum ApproverActionType {
  CERTIFIER = 'CERTIFIER',
  APPROVER = 'APPROVER',
}

export enum ApproverStatus {
  WAITING = 'WAITING',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('approvers')
export class Approver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // =========================
  // REQUEST
  // =========================

  @Column({
    name: 'request_id',
    type: 'uuid',
  })
  requestId: string;
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: User;

  @ManyToOne(() => Request, (request) => request.approvers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'request_id',
  })
  request: Request;

  // =========================
  // USER
  // =========================

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId: string;

  // =========================
  // APPROVAL ORDER
  // =========================

  @Column({
    type: 'int',
  })
  step: number;

  // =========================
  // ACTION TYPE
  // =========================

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: ApproverActionType,
  })
  actionType: ApproverActionType;

  // =========================
  // STATUS
  // =========================

  @Column({
    type: 'enum',
    enum: ApproverStatus,
    default: ApproverStatus.WAITING,
  })
  status: ApproverStatus;

  // =========================
  // ACTION INFORMATION
  // =========================

  @Column({
    name: 'action_date',
    type: 'timestamp',
    nullable: true,
  })
  actionDate: Date | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  remark: string | null;

  // =========================
  // TIMESTAMPS
  // =========================

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
