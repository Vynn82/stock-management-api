import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Goods received for a new-product line no longer create the product. The
 * line waits until the manager adds the product to the catalogue and marks it
 * done: catalog_added_at records when.
 */
export class PurchaseOrderPendingCatalog1790900000000 implements MigrationInterface {
  name = 'PurchaseOrderPendingCatalog1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD COLUMN "catalog_added_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" DROP COLUMN "catalog_added_at"`,
    );
  }
}
