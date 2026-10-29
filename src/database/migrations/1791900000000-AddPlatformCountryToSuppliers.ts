import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A supplier can have an online platform (Telegram, WhatsApp...) with its
 * link / username, and a country. All optional.
 */
export class AddPlatformCountryToSuppliers1791900000000 implements MigrationInterface {
  name = 'AddPlatformCountryToSuppliers1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        ADD COLUMN "platform" varchar(30),
        ADD COLUMN "platform_link" varchar(300),
        ADD COLUMN "country" varchar(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "suppliers"
        DROP COLUMN "country",
        DROP COLUMN "platform_link",
        DROP COLUMN "platform"
    `);
  }
}
