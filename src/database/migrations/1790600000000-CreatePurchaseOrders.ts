import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Purchase orders + goods receiving.
 * The permissions are the existing REQUEST_* ones, so nothing to seed.
 */
export class CreatePurchaseOrders1790600000000 implements MigrationInterface {
  name = 'CreatePurchaseOrders1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE "purchase_order_number_seq" START 1`);
    await queryRunner.query(`CREATE SEQUENCE "goods_receipt_number_seq" START 1`);

    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "po_number" varchar(30) NOT NULL,
        "supplier_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'DRAFT',
        "note" text,
        "total_amount" decimal(15,2) NOT NULL DEFAULT 0,
        "created_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "approved_at" TIMESTAMP,
        "rejection_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_purchase_orders_po_number" UNIQUE ("po_number"),
        CONSTRAINT "FK_purchase_orders_supplier" FOREIGN KEY ("supplier_id")
          REFERENCES "suppliers"("id"),
        CONSTRAINT "FK_purchase_orders_warehouse" FOREIGN KEY ("warehouse_id")
          REFERENCES "warehouses"("id"),
        CONSTRAINT "FK_purchase_orders_created_by" FOREIGN KEY ("created_by_id")
          REFERENCES "users"("id"),
        CONSTRAINT "FK_purchase_orders_approved_by" FOREIGN KEY ("approved_by_id")
          REFERENCES "users"("id"),
        CONSTRAINT "CHK_purchase_orders_status" CHECK ("status" IN
          ('DRAFT','SUBMITTED','APPROVED','REJECTED','PARTIALLY_RECEIVED','RECEIVED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_status" ON "purchase_orders" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_supplier_id" ON "purchase_orders" ("supplier_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "purchase_order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "purchase_order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "quantity" decimal(15,3) NOT NULL,
        "received_quantity" decimal(15,3) NOT NULL DEFAULT 0,
        "unit_price" decimal(15,2) NOT NULL,
        "line_total" decimal(15,2) NOT NULL,

        CONSTRAINT "PK_purchase_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_purchase_order_items_po" FOREIGN KEY ("purchase_order_id")
          REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_purchase_order_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id"),
        CONSTRAINT "FK_purchase_order_items_variant" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id"),
        CONSTRAINT "CHK_purchase_order_items_quantity" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_purchase_order_items_received"
          CHECK ("received_quantity" >= 0 AND "received_quantity" <= "quantity"),
        CONSTRAINT "CHK_purchase_order_items_price" CHECK ("unit_price" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_items_po_id" ON "purchase_order_items" ("purchase_order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "goods_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "receipt_number" varchar(30) NOT NULL,
        "purchase_order_id" uuid NOT NULL,
        "received_by_id" uuid NOT NULL,
        "note" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_goods_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_goods_receipts_number" UNIQUE ("receipt_number"),
        CONSTRAINT "FK_goods_receipts_po" FOREIGN KEY ("purchase_order_id")
          REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_goods_receipts_received_by" FOREIGN KEY ("received_by_id")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_goods_receipts_po_id" ON "goods_receipts" ("purchase_order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "goods_receipt_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "goods_receipt_id" uuid NOT NULL,
        "purchase_order_item_id" uuid NOT NULL,
        "quantity" decimal(15,3) NOT NULL,

        CONSTRAINT "PK_goods_receipt_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_goods_receipt_items_receipt" FOREIGN KEY ("goods_receipt_id")
          REFERENCES "goods_receipts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_goods_receipt_items_po_item" FOREIGN KEY ("purchase_order_item_id")
          REFERENCES "purchase_order_items"("id"),
        CONSTRAINT "CHK_goods_receipt_items_quantity" CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_goods_receipt_items_receipt_id" ON "goods_receipt_items" ("goods_receipt_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "goods_receipt_items"`);
    await queryRunner.query(`DROP TABLE "goods_receipts"`);
    await queryRunner.query(`DROP TABLE "purchase_order_items"`);
    await queryRunner.query(`DROP TABLE "purchase_orders"`);
    await queryRunner.query(`DROP SEQUENCE "goods_receipt_number_seq"`);
    await queryRunner.query(`DROP SEQUENCE "purchase_order_number_seq"`);
  }
}
