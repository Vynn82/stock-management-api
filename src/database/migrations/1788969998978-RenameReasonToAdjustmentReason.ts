import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameReasonToAdjustmentReason1788969998978 implements MigrationInterface {
  name = 'RenameReasonToAdjustmentReason1788969998978';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "request_items"
      RENAME COLUMN "reason" TO "adjustment_reason"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "request_items"
      RENAME COLUMN "adjustment_reason" TO "reason"
    `);
  }
}
