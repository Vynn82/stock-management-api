import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserRoles1787502082166 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "user_id" uuid NOT NULL,

        "role_id" uuid NOT NULL,

        CONSTRAINT "PK_user_roles_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_user_roles_user_role"
          UNIQUE ("user_id", "role_id"),

        CONSTRAINT "FK_user_roles_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_user_roles_role"
          FOREIGN KEY ("role_id")
          REFERENCES "roles"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "user_roles"
    `);
  }
}
