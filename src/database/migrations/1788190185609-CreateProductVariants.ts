import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductVariants1788106000000 implements MigrationInterface {
  name = 'CreateProductVariants1788106000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "product_variants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "product_id" uuid NOT NULL,

        "code" character varying(100) NOT NULL,
        "name" character varying(200) NOT NULL,

        "sku" character varying(100) NOT NULL,
        "barcode" character varying(100),

        "attributes" jsonb,

        "cost_price" numeric(15,2),
        "selling_price" numeric(15,2),

        "is_active" boolean NOT NULL DEFAULT true,

        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_product_variants_sku"
          UNIQUE ("sku"),

        CONSTRAINT "UQ_product_variants_barcode"
          UNIQUE ("barcode"),

        CONSTRAINT "PK_product_variants"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_product_variants_product"
          FOREIGN KEY ("product_id")
          REFERENCES "products"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "product_variants"
    `);
  }
}
