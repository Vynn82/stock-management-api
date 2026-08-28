import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1787499478939 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID generation
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
    `);

    // Generate numbers: 1, 2, 3, 4, ...
    // We will turn them into:
    // ABC00001, ABC00002, ABC00003, ...
    await queryRunner.query(`
      CREATE SEQUENCE staff_id_seq
      START WITH 1
      INCREMENT BY 1
    `);

    // User status
    await queryRunner.query(`
      CREATE TYPE "users_status_enum"
      AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED')
    `);

    // Users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "staff_id" character varying(8) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "status" "users_status_enum"
          NOT NULL DEFAULT 'ACTIVE',
        "must_change_password" boolean
          NOT NULL DEFAULT true,
        "created_by" uuid,
        "last_login_at" TIMESTAMP,
        "created_at" TIMESTAMP
          NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP
          NOT NULL DEFAULT now(),

        CONSTRAINT "PK_users_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_users_staff_id"
          UNIQUE ("staff_id")
      )
    `);

    // User profiles
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "email" character varying(255) NOT NULL,
        "phone" character varying(30),
        "telegram_chat_id" character varying(100),
        "avatar" character varying,
        "created_at" TIMESTAMP
          NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP
          NOT NULL DEFAULT now(),

        CONSTRAINT "PK_user_profiles_id"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_user_profiles_user_id"
          UNIQUE ("user_id"),

        CONSTRAINT "UQ_user_profiles_email"
          UNIQUE ("email"),

        CONSTRAINT "FK_user_profiles_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "user_profiles"
    `);

    await queryRunner.query(`
      DROP TABLE "users"
    `);

    await queryRunner.query(`
      DROP TYPE "users_status_enum"
    `);

    await queryRunner.query(`
      DROP SEQUENCE "staff_id_seq"
    `);
  }
}
