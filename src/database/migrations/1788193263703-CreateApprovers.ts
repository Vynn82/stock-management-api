import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApprovers1788108000000 implements MigrationInterface {
  name = 'CreateApprovers1788108000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "approver_action_type_enum" AS ENUM (
        'CERTIFIER',
        'APPROVER'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "approver_status_enum" AS ENUM (
        'WAITING',
        'PENDING',
        'APPROVED',
        'REJECTED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "approvers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),

        "request_id" uuid NOT NULL,

        "user_id" uuid NOT NULL,

        "step" integer NOT NULL,

        "action_type"
          "approver_action_type_enum" NOT NULL,

        "status"
          "approver_status_enum"
          NOT NULL DEFAULT 'WAITING',

        "action_date" TIMESTAMP,

        "remark" text,

        "created_at"
          TIMESTAMP NOT NULL DEFAULT now(),

        "updated_at"
          TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_approvers"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_approvers_request"
          FOREIGN KEY ("request_id")
          REFERENCES "requests"("id")
          ON DELETE CASCADE,

        CONSTRAINT "UQ_approvers_request_step"
          UNIQUE ("request_id", "step")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approvers_request_id"
      ON "approvers" ("request_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approvers_user_id"
      ON "approvers" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_approvers_user_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_approvers_request_id"
    `);

    await queryRunner.query(`
      DROP TABLE "approvers"
    `);

    await queryRunner.query(`
      DROP TYPE "approver_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "approver_action_type_enum"
    `);
  }
}
