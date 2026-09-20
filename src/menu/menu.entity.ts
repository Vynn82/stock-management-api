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

@Entity('menus')
export class Menu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Internal unique name
  // Example: DASHBOARD, PRODUCTS, INVENTORY
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  name: string;

  // Text displayed in frontend
  // Example: Dashboard, Products, Inventory
  @Column({
    type: 'varchar',
    length: 100,
  })
  label: string;

  // Frontend route
  // Example: /dashboard, /products
  // Parent menus can have null path
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  path: string | null;

  // Frontend icon name
  // Example: LayoutDashboard, Package, Warehouse
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  icon: string | null;

  // Parent menu for submenus
  @Column({
    name: 'parent_id',
    type: 'uuid',
    nullable: true,
  })
  parentId: string | null;

  @ManyToOne(() => Menu, (menu) => menu.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'parent_id',
  })
  parent: Menu | null;

  @OneToMany(() => Menu, (menu) => menu.parent)
  children: Menu[];

  // Display order
  @Column({
    name: 'sort_order',
    type: 'int',
    default: 0,
  })
  sortOrder: number;

  // Can this menu be displayed?
  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  // Protect built-in/system menus
  @Column({
    name: 'is_system',
    type: 'boolean',
    default: false,
  })
  isSystem: boolean;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt: Date;
}
