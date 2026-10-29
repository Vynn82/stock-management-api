import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Editing a product's details gets its own permission (PRODUCT_EDIT) so
 * Manager can fix names, prices, SKU... without PRODUCT_UPDATE (which also
 * activates / deactivates products). Granted to SUPER_ADMIN, ADMIN, MANAGER.
 */
export class ProductEditPermission1791300000000 implements MigrationInterface {
  name = 'ProductEditPermission1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "permissions" ("id", "name", "resource", "action", "is_system")
       VALUES (uuid_generate_v4(), 'PRODUCT_EDIT', 'product', 'edit', true)
       ON CONFLICT ("name") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT uuid_generate_v4(), r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
        AND p."name" = 'PRODUCT_EDIT'
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp
          WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions" rp
      USING "permissions" p
      WHERE rp."permission_id" = p."id" AND p."name" = 'PRODUCT_EDIT'
    `);
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = 'PRODUCT_EDIT'`,
    );
  }
}
