import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProducts1788105000000 implements MigrationInterface {
  name = 'CreateProducts1788105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "code" character varying(50) NOT NULL,
        "name" character varying(200) NOT NULL,
        "description" text,

        "category_id" uuid NOT NULL,
        "brand_id" uuid,
        "supplier_id" uuid,

        "has_variants" boolean NOT NULL DEFAULT false,

        "unit" character varying(30) NOT NULL,
        "barcode" character varying(100),
        "sku" character varying(100) NOT NULL,

        "cost_price" numeric(15,2) NOT NULL DEFAULT 0,
        "selling_price" numeric(15,2) NOT NULL DEFAULT 0,

        "minimum_stock" numeric(15,3) NOT NULL DEFAULT 0,
        "maximum_stock" numeric(15,3),

        "is_active" boolean NOT NULL DEFAULT true,

        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_products_code"
          UNIQUE ("code"),

        CONSTRAINT "UQ_products_barcode"
          UNIQUE ("barcode"),

        CONSTRAINT "UQ_products_sku"
          UNIQUE ("sku"),

        CONSTRAINT "PK_products"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_products_category"
          FOREIGN KEY ("category_id")
          REFERENCES "categories"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_products_brand"
          FOREIGN KEY ("brand_id")
          REFERENCES "brands"("id")
          ON DELETE SET NULL,

        CONSTRAINT "FK_products_supplier"
          FOREIGN KEY ("supplier_id")
          REFERENCES "suppliers"("id")
          ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "products"
    `);
  }
}
