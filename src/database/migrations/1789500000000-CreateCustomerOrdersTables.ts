import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCustomerOrdersTables1789500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create customers table
    await queryRunner.createTable(
      new Table({
        name: 'customers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'telegram_user_id',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'telegram_chat_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'telegram_username',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'company_name',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // 2. Create customer_orders table
    await queryRunner.createTable(
      new Table({
        name: 'customer_orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'order_no',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'telegram_user_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'telegram_chat_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'PENDING_REVIEW'",
            isNullable: false,
          },
          {
            name: 'delivery_status',
            type: 'varchar',
            length: '30',
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'payment_status',
            type: 'varchar',
            length: '30',
            default: "'UNPAID'",
            isNullable: false,
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'paid_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'paid_received_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'delivery_address',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'remark',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'staff_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['customer_id'],
            referencedTableName: 'customers',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            columnNames: ['paid_received_by_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'customer_orders',
      new TableIndex({
        name: 'IDX_CUSTOMER_ORDERS_CUSTOMER_ID',
        columnNames: ['customer_id'],
      }),
    );

    await queryRunner.createIndex(
      'customer_orders',
      new TableIndex({
        name: 'IDX_CUSTOMER_ORDERS_STATUS',
        columnNames: ['status'],
      }),
    );

    // 3. Create customer_order_items table
    await queryRunner.createTable(
      new Table({
        name: 'customer_order_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'product_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'variant_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'warehouse_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'requested_quantity',
            type: 'decimal',
            precision: 15,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'approved_quantity',
            type: 'decimal',
            precision: 15,
            scale: 3,
            default: 0,
            isNullable: false,
          },
          {
            name: 'waiting_quantity',
            type: 'decimal',
            precision: 15,
            scale: 3,
            default: 0,
            isNullable: false,
          },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['order_id'],
            referencedTableName: 'customer_orders',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['product_id'],
            referencedTableName: 'products',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            columnNames: ['variant_id'],
            referencedTableName: 'product_variants',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            columnNames: ['warehouse_id'],
            referencedTableName: 'warehouses',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'customer_order_items',
      new TableIndex({
        name: 'IDX_CUSTOMER_ORDER_ITEMS_ORDER_ID',
        columnNames: ['order_id'],
      }),
    );

    // 4. Create customer_order_messages table
    await queryRunner.createTable(
      new Table({
        name: 'customer_order_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'sender_type',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'sender_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'sender_name',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'message_type',
            type: 'varchar',
            length: '30',
            default: "'TEXT'",
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['order_id'],
            referencedTableName: 'customer_orders',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // 5. Create customer_order_payments table
    await queryRunner.createTable(
      new Table({
        name: 'customer_order_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'payment_method',
            type: 'varchar',
            length: '30',
            default: "'CASH'",
            isNullable: false,
          },
          {
            name: 'payment_status',
            type: 'varchar',
            length: '30',
            default: "'PAID'",
            isNullable: false,
          },
          {
            name: 'received_by_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'received_at',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'remark',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['order_id'],
            referencedTableName: 'customer_orders',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['received_by_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('customer_order_payments');
    await queryRunner.dropTable('customer_order_messages');
    await queryRunner.dropTable('customer_order_items');
    await queryRunner.dropTable('customer_orders');
    await queryRunner.dropTable('customers');
  }
}
