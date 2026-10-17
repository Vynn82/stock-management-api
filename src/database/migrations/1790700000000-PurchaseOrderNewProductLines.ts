import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A purchase order line can be a product that is not in the catalogue yet:
 * product_id stays empty and the new_product_* columns describe it. The
 * product is created when its goods are received.
 */
export class PurchaseOrderNewProductLines1790700000000 implements MigrationInterface {
  name = 'PurchaseOrderNewProductLines1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ALTER COLUMN "product_id" DROP NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
        ADD COLUMN "new_product_name" varchar(200),
        ADD COLUMN "new_product_category_id" uuid,
        ADD COLUMN "new_product_unit" varchar(30),
        ADD COLUMN "new_product_sku" varchar(100),
        ADD CONSTRAINT "FK_purchase_order_items_new_category"
          FOREIGN KEY ("new_product_category_id") REFERENCES "categories"("id"),
        ADD CONSTRAINT "CHK_purchase_order_items_product_or_new"
          CHECK ("product_id" IS NOT NULL OR
                 ("new_product_name" IS NOT NULL AND "new_product_category_id" IS NOT NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "purchase_order_items" WHERE "product_id" IS NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
        DROP CONSTRAINT "CHK_purchase_order_items_product_or_new",
        DROP CONSTRAINT "FK_purchase_order_items_new_category",
        DROP COLUMN "new_product_sku",
        DROP COLUMN "new_product_unit",
        DROP COLUMN "new_product_category_id",
        DROP COLUMN "new_product_name"
    `);
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ALTER COLUMN "product_id" SET NOT NULL`,
    );
  }
}
