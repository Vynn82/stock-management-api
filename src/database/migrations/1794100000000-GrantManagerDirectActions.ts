import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Manager no longer needs anyone's approval: only Staff requests are reviewed.
 * So MANAGER also gets the permissions to create a product (PRODUCT_CREATE)
 * and to change stock directly (STOCK_ADJUST). The seed does the same on fresh
 * databases; this migration does it on existing ones.
 */
export class GrantManagerDirectActions1794100000000
  implements MigrationInterface
{
  name = 'GrantManagerDirectActions1794100000000';

  private readonly permissions = ['PRODUCT_CREATE', 'STOCK_ADJUST'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT uuid_generate_v4(), r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" = 'MANAGER'
        AND p."name" = ANY($1)
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp
          WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )
    `,
      [this.permissions],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "role_permissions" rp
      USING "roles" r, "permissions" p
      WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        AND r."name" = 'MANAGER' AND p."name" = ANY($1)
    `,
      [this.permissions],
    );
  }
}
