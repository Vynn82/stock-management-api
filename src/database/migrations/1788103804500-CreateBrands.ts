import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrands178806xxxxxxx implements MigrationInterface {
  name = 'CreateBrands178806xxxxxxx';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "brands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_brands_code"
          UNIQUE ("code"),

        CONSTRAINT "UQ_brands_name"
          UNIQUE ("name"),

        CONSTRAINT "PK_brands"
          PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "brands"
    `);
  }
}
