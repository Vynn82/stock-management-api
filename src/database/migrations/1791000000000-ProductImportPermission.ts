import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Excel product import gets its own permission (PRODUCT_IMPORT) so Manager can
 * use it without PRODUCT_CREATE (which would let Manager skip the approval
 * flow in Add Product). Granted to SUPER_ADMIN, ADMIN and MANAGER.
 */
export class ProductImportPermission1791000000000 implements MigrationInterface {
  name = 'ProductImportPermission1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "permissions" ("id", "name", "resource", "action", "is_system")
       VALUES (uuid_generate_v4(), 'PRODUCT_IMPORT', 'product', 'import', true)
       ON CONFLICT ("name") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT uuid_generate_v4(), r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
        AND p."name" = 'PRODUCT_IMPORT'
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
      WHERE rp."permission_id" = p."id" AND p."name" = 'PRODUCT_IMPORT'
    `);
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = 'PRODUCT_IMPORT'`,
    );
  }
}
