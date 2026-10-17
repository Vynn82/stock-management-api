import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Purchase orders get their own permissions instead of borrowing REQUEST_*:
 *   PO_CREATE  -> MANAGER  (create / edit / submit)
 *   PO_APPROVE -> ADMIN    (approve / reject)
 *   PO_RECEIVE -> STAFF    (receive goods)
 *   PO_VIEW    -> all three
 * SUPER_ADMIN gets all of them. The seed does the same on fresh databases.
 */
export class PurchaseOrderPermissions1790800000000 implements MigrationInterface {
  name = 'PurchaseOrderPermissions1790800000000';

  private static readonly PERMISSIONS = [
    'view',
    'create',
    'approve',
    'receive',
  ];

  private static readonly GRANTS: Record<string, string[]> = {
    SUPER_ADMIN: ['PO_VIEW', 'PO_CREATE', 'PO_APPROVE', 'PO_RECEIVE'],
    ADMIN: ['PO_VIEW', 'PO_APPROVE'],
    MANAGER: ['PO_VIEW', 'PO_CREATE'],
    STAFF: ['PO_VIEW', 'PO_RECEIVE'],
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const action of PurchaseOrderPermissions1790800000000.PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO "permissions" ("id", "name", "resource", "action", "is_system")
         VALUES (uuid_generate_v4(), $1, 'po', $2, true)
         ON CONFLICT ("name") DO NOTHING`,
        [`PO_${action.toUpperCase()}`, action],
      );
    }

    for (const [role, names] of Object.entries(
      PurchaseOrderPermissions1790800000000.GRANTS,
    )) {
      for (const name of names) {
        await queryRunner.query(
          `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
           SELECT uuid_generate_v4(), r."id", p."id"
           FROM "roles" r
           CROSS JOIN "permissions" p
           WHERE r."name" = $1 AND p."name" = $2
             AND NOT EXISTS (
               SELECT 1 FROM "role_permissions" rp
               WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
             )`,
          [role, name],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions" rp
      USING "permissions" p
      WHERE rp."permission_id" = p."id" AND p."name" LIKE 'PO\\_%'
    `);
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" LIKE 'PO\\_%'`,
    );
  }
}
