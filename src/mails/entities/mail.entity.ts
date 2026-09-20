import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('mails')
export class Mail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'recipient_id',
    type: 'uuid',
  })
  recipientId: string;

  @Column({
    name: 'request_id',
    type: 'uuid',
  })
  requestId: string;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 100,
  })
  requestType: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  subject: string;

  @Column({
    type: 'text',
  })
  message: string;

  @Column({
    type: 'varchar',
    length: 50,
  })
  action: string;

  @Column({
    name: 'request_url',
    type: 'varchar',
    length: 255,
  })
  requestUrl: string;

  @Column({
    name: 'is_read',
    default: false,
  })
  isRead: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;
}
