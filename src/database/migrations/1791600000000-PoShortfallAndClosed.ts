import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Goods receiving can say why a line was short (not arrived / damaged /
 * wrong item) and a partly received order can be closed (the rest is not
 * coming):
 *  - goods_receipt_issues: one row per short line of a delivery (record only,
 *    never changes stock);
 *  - purchase_orders.status accepts CLOSED.
 */
export class PoShortfallAndClosed1791600000000 implements MigrationInterface {
  name = 'PoShortfallAndClosed1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "goods_receipt_issues" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "goods_receipt_id" uuid NOT NULL,
        "purchase_order_item_id" uuid NOT NULL,
        "reason" varchar(20) NOT NULL,
        "quantity" decimal(15,3) NOT NULL,
        CONSTRAINT "PK_goods_receipt_issues" PRIMARY KEY ("id"),
        CONSTRAINT "FK_goods_receipt_issues_receipt" FOREIGN KEY ("goods_receipt_id")
          REFERENCES "goods_receipts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_goods_receipt_issues_po_item" FOREIGN KEY ("purchase_order_item_id")
          REFERENCES "purchase_order_items"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_goods_receipt_issues_reason"
          CHECK ("reason" IN ('NOT_ARRIVED','DAMAGED','WRONG_ITEM')),
        CONSTRAINT "CHK_goods_receipt_issues_quantity" CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_goods_receipt_issues_receipt_id" ON "goods_receipt_issues" ("goods_receipt_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT "CHK_purchase_orders_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "purchase_orders" ADD CONSTRAINT "CHK_purchase_orders_status"
        CHECK ("status" IN
          ('DRAFT','SUBMITTED','APPROVED','REJECTED','PARTIALLY_RECEIVED','RECEIVED','CLOSED'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "purchase_orders" SET "status" = 'PARTIALLY_RECEIVED' WHERE "status" = 'CLOSED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT "CHK_purchase_orders_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "purchase_orders" ADD CONSTRAINT "CHK_purchase_orders_status"
        CHECK ("status" IN
          ('DRAFT','SUBMITTED','APPROVED','REJECTED','PARTIALLY_RECEIVED','RECEIVED'))
    `);
    await queryRunner.query(`DROP TABLE "goods_receipt_issues"`);
  }
}
