import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocationToRequestItems1790400000000
  implements MigrationInterface
{
  name = 'AddLocationToRequestItems1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "request_items" ADD COLUMN IF NOT EXISTS "location" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "request_items" DROP COLUMN IF EXISTS "location"`,
    );
  }
}
