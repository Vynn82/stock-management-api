import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocationFieldsToCustomers1789900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('customers', [
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
    await queryRunner.dropColumn('customers', 'commune');
    await queryRunner.dropColumn('customers', 'district');
    await queryRunner.dropColumn('customers', 'province');
    await queryRunner.dropColumn('customers', 'longitude');
    await queryRunner.dropColumn('customers', 'latitude');
  }
}

