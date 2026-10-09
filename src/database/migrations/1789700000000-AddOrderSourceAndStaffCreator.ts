import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddOrderSourceAndStaffCreator1789700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add source column to customer_orders table
    await queryRunner.addColumn(
      'customer_orders',
      new TableColumn({
        name: 'source',
        type: 'varchar',
        length: '30',
        default: "'MINI_APP'",
        isNullable: false,
      }),
    );

    // 2. Add created_by_staff_id column to customer_orders table
    await queryRunner.addColumn(
      'customer_orders',
      new TableColumn({
        name: 'created_by_staff_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // 3. Add Foreign Key created_by_staff_id -> users.id
    await queryRunner.createForeignKey(
      'customer_orders',
      new TableForeignKey({
        name: 'FK_customer_orders_created_by_staff_id',
        columnNames: ['created_by_staff_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // 4. Add Indexes
    await queryRunner.createIndex(
      'customer_orders',
      new TableIndex({
        name: 'IDX_customer_orders_source',
        columnNames: ['source'],
      }),
    );

    await queryRunner.createIndex(
      'customer_orders',
      new TableIndex({
        name: 'IDX_customer_orders_created_by_staff_id',
        columnNames: ['created_by_staff_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'customer_orders',
      'IDX_customer_orders_created_by_staff_id',
    );
    await queryRunner.dropIndex(
      'customer_orders',
      'IDX_customer_orders_source',
    );
    await queryRunner.dropForeignKey(
      'customer_orders',
      'FK_customer_orders_created_by_staff_id',
    );
    await queryRunner.dropColumn('customer_orders', 'created_by_staff_id');
    await queryRunner.dropColumn('customer_orders', 'source');
  }
}
