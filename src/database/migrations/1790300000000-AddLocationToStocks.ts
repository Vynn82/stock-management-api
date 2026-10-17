import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocationToStocks1790300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'stocks',
      new TableColumn({
        name: 'location',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('stocks', 'location');
  }
}
