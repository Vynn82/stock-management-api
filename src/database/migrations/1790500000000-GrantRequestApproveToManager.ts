import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MANAGER may approve requests (not only certify them). The seed grants this
 * on fresh databases; this migration does the same on existing ones.
 */
export class GrantRequestApproveToManager1790500000000
  implements MigrationInterface
{
  name = 'GrantRequestApproveToManager1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT uuid_generate_v4(), r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" = 'MANAGER'
        AND p."name" = 'REQUEST_APPROVE'
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp
          WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions" rp
      USING "roles" r, "permissions" p
      WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        AND r."name" = 'MANAGER' AND p."name" = 'REQUEST_APPROVE'
    `);
  }
}
