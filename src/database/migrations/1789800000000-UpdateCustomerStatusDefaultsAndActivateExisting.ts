import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCustomerStatusDefaultsAndActivateExisting1789800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Update default values on customers table
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "is_active" SET DEFAULT true`,
    );

    // 2. Auto-activate any legacy PENDING customer registrations
    await queryRunner.query(
      `UPDATE "customers" SET "status" = 'ACTIVE', "is_active" = true WHERE "status" = 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ALTER COLUMN "is_active" SET DEFAULT false`,
    );
  }
}
