import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocationFieldsToCustomerOrders1789910000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('customer_orders', [
      new TableColumn({
        name: 'latitude',
        type: 'decimal',
        precision: 10,
        scale: 7,
        isNullable: true,
      }),
      new TableColumn({
        name: 'longitude',
        type: 'decimal',
        precision: 10,
        scale: 7,
        isNullable: true,
      }),
      new TableColumn({
        name: 'province',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'district',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'commune',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('customer_orders', 'commune');
    await queryRunner.dropColumn('customer_orders', 'district');
    await queryRunner.dropColumn('customer_orders', 'province');
    await queryRunner.dropColumn('customer_orders', 'longitude');
    await queryRunner.dropColumn('customer_orders', 'latitude');
  }
}

