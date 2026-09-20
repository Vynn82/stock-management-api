import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockAdjustments1788968044328 implements MigrationInterface {
  name = 'CreateStockAdjustments1788968044328';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stock_adjustments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "request_id" uuid NOT NULL,

        "product_id" uuid NOT NULL,

        "variant_id" uuid,

        "warehouse_id" uuid NOT NULL,

        "adjustment_type" varchar(20) NOT NULL,

        "quantity" decimal(15,3) NOT NULL,

        "reason" text NOT NULL,

        "created_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_stock_adjustments"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_stock_adjustments_request"
          FOREIGN KEY ("request_id")
          REFERENCES "requests"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_stock_adjustments_product"
          FOREIGN KEY ("product_id")
          REFERENCES "products"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_stock_adjustments_variant"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_stock_adjustments_warehouse"
          FOREIGN KEY ("warehouse_id")
          REFERENCES "warehouses"("id")
          ON DELETE CASCADE,

        CONSTRAINT "CHK_stock_adjustments_type"
          CHECK ("adjustment_type" IN ('INCREASE', 'DECREASE')),

        CONSTRAINT "CHK_stock_adjustments_quantity"
          CHECK ("quantity" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stock_adjustments_request_id"
      ON "stock_adjustments" ("request_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stock_adjustments_product_id"
      ON "stock_adjustments" ("product_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stock_adjustments_variant_id"
      ON "stock_adjustments" ("variant_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_stock_adjustments_warehouse_id"
      ON "stock_adjustments" ("warehouse_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_stock_adjustments_warehouse_id"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."IDX_stock_adjustments_variant_id"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."IDX_stock_adjustments_product_id"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."IDX_stock_adjustments_request_id"
    `);

    await queryRunner.query(`
      DROP TABLE "stock_adjustments"
    `);
  }
}
