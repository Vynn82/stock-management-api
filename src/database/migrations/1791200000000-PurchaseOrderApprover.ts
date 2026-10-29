import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Manager's purchase order is sent to a chosen Admin / Super Admin for
 * approval: requested_approver_id records who. Admins can now create purchase
 * orders themselves (PO_CREATE); theirs are approved automatically.
 */
export class PurchaseOrderApprover1791200000000 implements MigrationInterface {
  name = 'PurchaseOrderApprover1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD COLUMN "requested_approver_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders"
       ADD CONSTRAINT "FK_purchase_orders_requested_approver"
       FOREIGN KEY ("requested_approver_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
       SELECT uuid_generate_v4(), r."id", p."id"
       FROM "roles" r
       CROSS JOIN "permissions" p
       WHERE r."name" IN ('ADMIN', 'SUPER_ADMIN') AND p."name" = 'PO_CREATE'
         AND NOT EXISTS (
           SELECT 1 FROM "role_permissions" rp
           WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_purchase_orders_requested_approver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP COLUMN "requested_approver_id"`,
    );
    await queryRunner.query(
      `DELETE FROM "role_permissions" rp
       USING "roles" r, "permissions" p
       WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
         AND r."name" = 'ADMIN' AND p."name" = 'PO_CREATE'`,
    );
  }
}
