import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePermissions1787501243465 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "name" character varying(100) NOT NULL,

        "description" text,

        "resource" character varying(100) NOT NULL,

        "action" character varying(50) NOT NULL,

        "is_system" boolean NOT NULL DEFAULT true,

        "created_at" TIMESTAMP NOT NULL DEFAULT now(),

        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_permissions_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_permissions_name"
          UNIQUE ("name")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "permissions"
    `);
  }
}
