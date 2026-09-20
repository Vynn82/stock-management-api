import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategories178806xxxxxxx implements MigrationInterface {
  name = 'CreateCategories178806xxxxxxx';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_categories_code"
          UNIQUE ("code"),

        CONSTRAINT "UQ_categories_name"
          UNIQUE ("name"),

        CONSTRAINT "PK_categories"
          PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "categories"
    `);
  }
}
