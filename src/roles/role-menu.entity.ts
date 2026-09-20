import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Role } from './role.entity';
import { Menu } from '../menu/menu.entity';

@Entity('role_menus')
@Unique(['roleId', 'menuId'])
export class RoleMenu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'role_id',
    type: 'uuid',
  })
  roleId: string;

  @Column({
    name: 'menu_id',
    type: 'uuid',
  })
  menuId: string;

  @ManyToOne(() => Role, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'role_id',
  })
  role: Role;

  @ManyToOne(() => Menu, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'menu_id',
  })
  menu: Menu;
}
