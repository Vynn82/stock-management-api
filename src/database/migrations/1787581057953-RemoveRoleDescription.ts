import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveRoleDescription1787581057953 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "roles"
      DROP COLUMN "description"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "roles"
      ADD COLUMN "description" text
    `);
  }
}
