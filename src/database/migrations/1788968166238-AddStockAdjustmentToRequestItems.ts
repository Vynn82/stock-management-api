import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockAdjustmentToRequestItems1788965543026 implements MigrationInterface {
  name = 'AddStockAdjustmentToRequestItems1788965543026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "request_items"
      ADD COLUMN "adjustment_type" varchar(20)
    `);

    await queryRunner.query(`
      ALTER TABLE "request_items"
      ADD COLUMN "reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "request_items"
      ADD CONSTRAINT "CHK_request_items_adjustment_type"
      CHECK (
        "adjustment_type" IS NULL
        OR "adjustment_type" IN ('INCREASE', 'DECREASE')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "request_items"
      DROP CONSTRAINT "CHK_request_items_adjustment_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "request_items"
      DROP COLUMN "reason"
    `);

    await queryRunner.query(`
      ALTER TABLE "request_items"
      DROP COLUMN "adjustment_type"
    `);
  }
}
