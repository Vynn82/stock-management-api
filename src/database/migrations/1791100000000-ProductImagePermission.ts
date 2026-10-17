import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Changing a product photo gets its own permission (PRODUCT_IMAGE) so Manager
 * can add photos to imported products without PRODUCT_UPDATE (which also
 * activates / deactivates products). Granted to SUPER_ADMIN, ADMIN, MANAGER.
 */
export class ProductImagePermission1791100000000 implements MigrationInterface {
  name = 'ProductImagePermission1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "permissions" ("id", "name", "resource", "action", "is_system")
       VALUES (uuid_generate_v4(), 'PRODUCT_IMAGE', 'product', 'image', true)
       ON CONFLICT ("name") DO NOTHING`,
    );
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT uuid_generate_v4(), r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
        AND p."name" = 'PRODUCT_IMAGE'
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
      WHERE rp."permission_id" = p."id" AND p."name" = 'PRODUCT_IMAGE'
    `);
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = 'PRODUCT_IMAGE'`,
    );
  }
}
