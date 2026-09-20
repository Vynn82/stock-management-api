import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddImageToProductVariants1788880862440 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'product_variants',
      new TableColumn({
        name: 'image',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('product_variants', 'image');
  }
}
