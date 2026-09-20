import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWarehouses1788104163699 implements MigrationInterface {
  name = 'CreateWarehouses1788104163699';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" text,
        "address" text,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "contact_person" character varying(100),
        "phone" character varying(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_warehouses_code"
          UNIQUE ("code"),

        CONSTRAINT "UQ_warehouses_name"
          UNIQUE ("name"),

        CONSTRAINT "PK_warehouses"
          PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "warehouses"
    `);
  }
}
