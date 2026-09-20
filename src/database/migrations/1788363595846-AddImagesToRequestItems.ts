import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImagesToRequestItems1788363595846 implements MigrationInterface {
  name = 'AddImagesToRequestItems1788363595846';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "request_items"
      ADD COLUMN "product_image" text
    `);

    await queryRunner.query(`
      ALTER TABLE "request_items"
      ADD COLUMN "variant_image" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "request_items"
      DROP COLUMN "variant_image"
    `);

    await queryRunner.query(`
      ALTER TABLE "request_items"
      DROP COLUMN "product_image"
    `);
  }
}
