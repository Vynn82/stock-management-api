import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A new-product line on a purchase order can name the product's brand
 * (optional). The brand is put on the product when it is created at receiving.
 */
export class PoNewProductBrand1791800000000 implements MigrationInterface {
  name = 'PoNewProductBrand1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
        ADD COLUMN "new_product_brand_id" uuid,
        ADD CONSTRAINT "FK_purchase_order_items_new_brand"
          FOREIGN KEY ("new_product_brand_id") REFERENCES "brands"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
        DROP CONSTRAINT "FK_purchase_order_items_new_brand",
        DROP COLUMN "new_product_brand_id"
    `);
  }
}
