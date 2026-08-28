import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRolePermissions1787502927165 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "role_id" uuid NOT NULL,

        "permission_id" uuid NOT NULL,

        CONSTRAINT "PK_role_permissions"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_role_permissions_role_permission"
          UNIQUE ("role_id", "permission_id"),

        CONSTRAINT "FK_role_permissions_role"
          FOREIGN KEY ("role_id")
          REFERENCES "roles"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_role_permissions_permission"
          FOREIGN KEY ("permission_id")
          REFERENCES "permissions"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "role_permissions"
    `);
  }
}
