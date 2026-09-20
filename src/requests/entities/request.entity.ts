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

import { RequestItem } from './request-item.entity';

import { RequestSource } from '../enum/request-source.enum';
import { RequestType } from '../enum/request-type.enum';
import { RequestStatus } from '../enum/request-status.enum';
import { Approver } from './approver.entity';
import { User } from '../../users/entities/user.entity';

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // =========================
  // REQUEST NUMBER
  // =========================

  @Column({
    name: 'request_no',
    type: 'varchar',
    length: 50,
    unique: true,
  })
  requestNo: string;

  // =========================
  // REQUESTER
  // =========================

  @Column({
    name: 'requester_id',
    type: 'uuid',
  })
  requesterId: string;

  @ManyToOne(() => User, {
    nullable: false,
  })
  @JoinColumn({
    name: 'requester_id',
  })
  requester: User;
  // =========================
  // REQUEST INFORMATION
  // =========================

  @Column({
    name: 'request_type',
    type: 'enum',
    enum: RequestType,
  })
  requestType: RequestType;

  @Column({
    type: 'enum',
    enum: RequestSource,
  })
  source: RequestSource;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  // =========================
  // APPROVAL TRACKING
  // =========================

  @Column({
    name: 'current_step',
    type: 'int',
    default: 1,
  })
  currentStep: number;

  // =========================
  // REMARK
  // =========================

  @Column({
    type: 'text',
    nullable: true,
  })
  remark: string | null;

  // =========================
  // ITEMS
  // =========================

  @OneToMany(() => RequestItem, (item) => item.request, {
    cascade: true,
  })
  items: RequestItem[];

  @OneToMany(() => Approver, (approver) => approver.request)
  approvers: Approver[];
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
