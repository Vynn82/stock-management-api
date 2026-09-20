import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeStockAdjustmentRequestIdNullable1789000000000 implements MigrationInterface {
  name = 'MakeStockAdjustmentRequestIdNullable1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" ALTER COLUMN "request_id" DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" ADD COLUMN "adjusted_by_id" uuid;
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" ADD CONSTRAINT "FK_stock_adjustments_adjusted_by"
        FOREIGN KEY ("adjusted_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stock_adjustments_adjusted_by_id"
        ON "stock_adjustments" ("adjusted_by_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_stock_adjustments_adjusted_by_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" DROP CONSTRAINT IF EXISTS "FK_stock_adjustments_adjusted_by";
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" DROP COLUMN IF EXISTS "adjusted_by_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" ALTER COLUMN "request_id" SET NOT NULL;
    `);
  }
}
