import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockAdjustmentMovementType1794000000000 implements MigrationInterface {
  name = 'AddStockAdjustmentMovementType1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" ADD COLUMN IF NOT EXISTS "movement_type" character varying(20);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stock_adjustments" DROP COLUMN IF EXISTS "movement_type";
    `);
  }
}
