import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSuppliers178806xxxxxxx implements MigrationInterface {
  name = 'CreateSuppliers178806xxxxxxx';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "contact_person" character varying(100),
        "phone" character varying(50),
        "email" character varying(150),
        "address" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_suppliers_code"
          UNIQUE ("code"),

        CONSTRAINT "UQ_suppliers_name"
          UNIQUE ("name"),

        CONSTRAINT "PK_suppliers"
          PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "suppliers"
    `);
  }
}
