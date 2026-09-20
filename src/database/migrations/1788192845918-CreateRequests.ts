import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRequests1788107000000 implements MigrationInterface {
  name = 'CreateRequests1788107000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =====================================================
    // REQUESTS
    // =====================================================

    await queryRunner.query(`
      CREATE TYPE "request_source_enum" AS ENUM (
        'MANUAL',
        'EXCEL'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "request_type_enum" AS ENUM (
        'PRODUCT_CREATE',
        'PRODUCT_UPDATE',
        'VARIANT_CREATE',
        'VARIANT_UPDATE',
        'STOCK_IN',
        'STOCK_OUT',
        'STOCK_TRANSFER',
        'STOCK_ADJUSTMENT'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "request_status_enum" AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "request_no" character varying(50) NOT NULL,

        "requester_id" uuid NOT NULL,

        "request_type" "request_type_enum" NOT NULL,

        "source" "request_source_enum" NOT NULL,

        "status" "request_status_enum"
          NOT NULL DEFAULT 'PENDING',

        "current_step" integer
          NOT NULL DEFAULT 1,

        "remark" text,

        "created_at" TIMESTAMP
          NOT NULL DEFAULT now(),

        "updated_at" TIMESTAMP
          NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_requests_request_no"
          UNIQUE ("request_no"),

        CONSTRAINT "PK_requests"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_requests_requester"
          FOREIGN KEY ("requester_id")
          REFERENCES "users"("id")
          ON DELETE RESTRICT
      )
    `);

    // =====================================================
    // REQUEST ITEMS
    // =====================================================

    await queryRunner.query(`
      CREATE TABLE "request_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "request_id" uuid NOT NULL,

        "product_code" character varying(50) NOT NULL,
        "product_name" character varying(200) NOT NULL,
        "description" text,

        "category_code" character varying(50) NOT NULL,
        "brand_code" character varying(50),
        "supplier_code" character varying(50),

        "has_variants" boolean
          NOT NULL DEFAULT false,

        "unit" character varying(30) NOT NULL,

        "product_sku" character varying(100) NOT NULL,
        "product_barcode" character varying(100),

        "product_cost_price"
          numeric(15,2),

        "product_selling_price"
          numeric(15,2),

        "minimum_stock"
          numeric(15,3),

        "maximum_stock"
          numeric(15,3),

        "variant_code"
          character varying(100),

        "variant_name"
          character varying(200),

        "variant_sku"
          character varying(100),

        "variant_barcode"
          character varying(100),

        "variant_attributes"
          jsonb,

        "variant_cost_price"
          numeric(15,2),

        "variant_selling_price"
          numeric(15,2),

        "warehouse_code"
          character varying(50),

        "quantity"
          numeric(15,3),

        "from_warehouse_code"
          character varying(50),

        "to_warehouse_code"
          character varying(50),

        "created_at" TIMESTAMP
          NOT NULL DEFAULT now(),

        "updated_at" TIMESTAMP
          NOT NULL DEFAULT now(),

        CONSTRAINT "PK_request_items"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_request_items_request"
          FOREIGN KEY ("request_id")
          REFERENCES "requests"("id")
          ON DELETE CASCADE
      )
    `);

    // =====================================================
    // INDEXES
    // =====================================================

    await queryRunner.query(`
      CREATE INDEX "IDX_requests_requester_id"
      ON "requests" ("requester_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_requests_status"
      ON "requests" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_requests_request_type"
      ON "requests" ("request_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_request_items_request_id"
      ON "request_items" ("request_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_request_items_product_code"
      ON "request_items" ("product_code")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_request_items_variant_code"
      ON "request_items" ("variant_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_request_items_variant_code"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_request_items_product_code"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_request_items_request_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_requests_request_type"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_requests_status"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_requests_requester_id"
    `);

    await queryRunner.query(`
      DROP TABLE "request_items"
    `);

    await queryRunner.query(`
      DROP TABLE "requests"
    `);

    await queryRunner.query(`
      DROP TYPE "request_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "request_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "request_source_enum"
    `);
  }
}
