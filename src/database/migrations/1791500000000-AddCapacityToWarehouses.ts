import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * A warehouse can have a storage limit: the most units (all products added
 * together) it may hold. Null = no limit.
 */
export class AddCapacityToWarehouses1791500000000
  implements MigrationInterface
{
  name = 'AddCapacityToWarehouses1791500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'warehouses',
      new TableColumn({
        name: 'capacity',
        type: 'decimal',
        precision: 15,
        scale: 3,
        isNullable: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('warehouses', 'capacity');
  }
}
