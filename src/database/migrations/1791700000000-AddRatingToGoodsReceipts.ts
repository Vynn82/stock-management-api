import { MigrationInterface, QueryRunner } from 'typeorm';

/** A delivery can be rated 1-5 when it is received (optional). */
export class AddRatingToGoodsReceipts1791700000000 implements MigrationInterface {
  name = 'AddRatingToGoodsReceipts1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "goods_receipts"
        ADD COLUMN "rating" smallint,
        ADD CONSTRAINT "CHK_goods_receipts_rating"
          CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "goods_receipts"
        DROP CONSTRAINT "CHK_goods_receipts_rating",
        DROP COLUMN "rating"
    `);
  }
}
