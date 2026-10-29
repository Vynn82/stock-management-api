import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Super Admin, Admin and Manager move stock between warehouses straight
 * away (no approval). Adds the STOCK_TRANSFER permission and the
 * stock_transfers table that records those direct transfers for history.
 */
export class DirectStockTransfers1792000000000 implements MigrationInterface {
  name = 'DirectStockTransfers1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stock_transfers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transferred_by_id" uuid,
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "from_warehouse_id" uuid NOT NULL,
        "to_warehouse_id" uuid NOT NULL,
        "quantity" numeric(15,3) NOT NULL,
        "reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_transfers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_transfers_user" FOREIGN KEY ("transferred_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_stock_transfers_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id"),
        CONSTRAINT "FK_stock_transfers_variant" FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id"),
        CONSTRAINT "FK_stock_transfers_from" FOREIGN KEY ("from_warehouse_id")
          REFERENCES "warehouses"("id"),
        CONSTRAINT "FK_stock_transfers_to" FOREIGN KEY ("to_warehouse_id")
          REFERENCES "warehouses"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_transfers_product" ON "stock_transfers" ("product_id")`,
    );

    await queryRunner.query(
      `INSERT INTO "permissions" ("id", "name", "resource", "action", "is_system")
       VALUES (uuid_generate_v4(), 'STOCK_TRANSFER', 'stock', 'transfer', true)
       ON CONFLICT ("name") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT uuid_generate_v4(), r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
        AND p."name" = 'STOCK_TRANSFER'
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp
          WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions" rp
      USING "permissions" p
      WHERE rp."permission_id" = p."id" AND p."name" = 'STOCK_TRANSFER'
    `);
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = 'STOCK_TRANSFER'`,
    );
    await queryRunner.query(`DROP TABLE "stock_transfers"`);
  }
}
