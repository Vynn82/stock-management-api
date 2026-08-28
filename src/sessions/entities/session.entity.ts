// import {
//   Column,
//   CreateDateColumn,
//   Entity,
//   JoinColumn,
//   ManyToOne,
//   PrimaryGeneratedColumn,
// } from 'typeorm';
//
// import { User } from '../../users/entities/user.entity';
//
// @Entity('sessions')
// export class Session {
//   @PrimaryGeneratedColumn('uuid')
//   id: string;
//
//   @Column({
//     name: 'user_id',
//     type: 'uuid',
//   })
//   userId: string;
//
//   @Column({
//     name: 'refresh_token_hash',
//     type: 'varchar',
//     length: 255,
//   })
//   refreshTokenHash: string;
//
//   @Column({
//     name: 'expires_at',
//     type: 'timestamptz',
//   })
//   expiresAt: Date;
//
//   @Column({
//     name: 'revoked_at',
//     type: 'timestamptz',
//     nullable: true,
//   })
//   revokedAt: Date | null;
//
//   @Column({
//     name: 'last_used_at',
//     type: 'timestamptz',
//     nullable: true,
//   })
//   lastUsedAt: Date | null;
//
//   @Column({
//     name: 'user_agent',
//     type: 'varchar',
//     length: 500,
//     nullable: true,
//   })
//   userAgent: string | null;
//
//   @Column({
//     name: 'ip_address',
//     type: 'varchar',
//     length: 45,
//     nullable: true,
//   })
//   ipAddress: string | null;
//
//   @CreateDateColumn({
//     name: 'created_at',
//   })
//   createdAt: Date;
//
//   @ManyToOne(() => User, (user) => user.sessions, {
//     onDelete: 'CASCADE',
//   })
//   @JoinColumn({
//     name: 'user_id',
//   })
//   user: User;
// }

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId: string;

  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
  })
  refreshTokenHash: string;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
  })
  expiresAt: Date;

  @Column({
    name: 'revoked_at',
    type: 'timestamp',
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({
    name: 'last_used_at',
    type: 'timestamp',
    nullable: true,
  })
  lastUsedAt: Date | null;

  @Column({
    name: 'user_agent',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  userAgent: string | null;

  @Column({
    name: 'ip_address',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  ipAddress: string | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: User;
}