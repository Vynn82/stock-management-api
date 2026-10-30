import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLoyaltyManagement1792200000000 implements MigrationInterface {
  name = 'CreateLoyaltyManagement1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create loyalty_tiers table
    await queryRunner.query(`
      CREATE TABLE "loyalty_tiers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "code" varchar(50) NOT NULL,
        "tier_rank" int NOT NULL DEFAULT 1,
        "min_orders" int NOT NULL DEFAULT 0,
        "min_spending" numeric(15,2) NOT NULL DEFAULT 0,
        "discount_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "color" varchar(50) NOT NULL DEFAULT '#64748B',
        "badge_icon" varchar(100),
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_loyalty_tiers_name" UNIQUE ("name"),
        CONSTRAINT "UQ_loyalty_tiers_code" UNIQUE ("code"),
        CONSTRAINT "PK_loyalty_tiers" PRIMARY KEY ("id")
      )
    `);

    // Seed default tiers
    await queryRunner.query(`
      INSERT INTO "loyalty_tiers" ("name", "code", "tier_rank", "min_orders", "min_spending", "discount_percent", "color", "description")
      VALUES
        ('New', 'NEW', 1, 0, 0.00, 0.00, '#64748B', 'Standard tier for new customers (0–1 orders, 0% discount).'),
        ('Returning', 'RETURNING', 2, 2, 2000.00, 2.00, '#0284C7', 'Returning tier (2+ orders and $2,000+ spending, 2% discount).'),
        ('Regular', 'REGULAR', 3, 5, 7500.00, 3.00, '#7C3AED', 'Regular tier (5+ orders and $7,500+ spending, 3% discount).'),
        ('VIP', 'VIP', 4, 10, 15000.00, 5.00, '#D97706', 'VIP premier tier (10+ orders and $15,000+ spending, 5% discount).')
      ON CONFLICT ("code") DO NOTHING
    `);

    // 2. Create loyalty_configs table
    await queryRunner.query(`
      CREATE TABLE "loyalty_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "is_enabled" boolean NOT NULL DEFAULT true,
        "min_profit_margin_percent" numeric(5,2) NOT NULL DEFAULT 10.00,
        "downgrade_policy" varchar(50) NOT NULL DEFAULT 'AUTOMATIC',
        "grace_period_days" int NOT NULL DEFAULT 30,
        "stacking_policy" varchar(50) NOT NULL DEFAULT 'HIGHEST_ONLY',
        "excluded_product_ids" jsonb NOT NULL DEFAULT '[]',
        "excluded_category_ids" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loyalty_configs" PRIMARY KEY ("id")
      )
    `);

    // Seed default config
    await queryRunner.query(`
      INSERT INTO "loyalty_configs" ("is_enabled", "min_profit_margin_percent", "downgrade_policy", "grace_period_days", "stacking_policy", "excluded_product_ids", "excluded_category_ids")
      VALUES (true, 10.00, 'AUTOMATIC', 30, 'HIGHEST_ONLY', '[]'::jsonb, '[]'::jsonb)
    `);

    // 3. Create customer_order_refunds table
    await queryRunner.query(`
      CREATE TABLE "customer_order_refunds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "refund_no" varchar(50) NOT NULL,
        "order_id" uuid NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "refund_type" varchar(30) NOT NULL DEFAULT 'PARTIAL',
        "reason" text,
        "processed_by_id" uuid,
        "items" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_customer_order_refunds_no" UNIQUE ("refund_no"),
        CONSTRAINT "PK_customer_order_refunds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customer_order_refunds_order" FOREIGN KEY ("order_id")
          REFERENCES "customer_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_customer_order_refunds_user" FOREIGN KEY ("processed_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // 4. Alter customers table
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "loyalty_tier_id" uuid,
        ADD COLUMN IF NOT EXISTS "manual_tier_override_id" uuid,
        ADD COLUMN IF NOT EXISTS "tier_override_expiry" TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "tier_override_notes" text,
        ADD COLUMN IF NOT EXISTS "lifetime_spending" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "completed_orders_count" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_quantity_purchased" numeric(15,3) NOT NULL DEFAULT 0,
        ADD CONSTRAINT "FK_customers_loyalty_tier" FOREIGN KEY ("loyalty_tier_id")
          REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_customers_manual_tier" FOREIGN KEY ("manual_tier_override_id")
          REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL
    `);

    // Assign default New tier to existing customers if null
    await queryRunner.query(`
      UPDATE "customers"
      SET "loyalty_tier_id" = (SELECT "id" FROM "loyalty_tiers" WHERE "code" = 'NEW' LIMIT 1)
      WHERE "loyalty_tier_id" IS NULL
    `);

    // 5. Alter customer_orders table
    await queryRunner.query(`
      ALTER TABLE "customer_orders"
        ADD COLUMN IF NOT EXISTS "subtotal_amount" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "loyalty_discount_percent" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "loyalty_discount_amount" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "loyalty_tier_id" uuid,
        ADD COLUMN IF NOT EXISTS "loyalty_tier_name" varchar(100),
        ADD COLUMN IF NOT EXISTS "refunded_amount" numeric(15,2) NOT NULL DEFAULT 0
    `);

    // Initialize subtotal_amount = total_amount for existing orders
    await queryRunner.query(`
      UPDATE "customer_orders"
      SET "subtotal_amount" = "total_amount"
      WHERE "subtotal_amount" = 0 AND "total_amount" > 0
    `);

    // 6. Alter customer_order_items table
    await queryRunner.query(`
      ALTER TABLE "customer_order_items"
        ADD COLUMN IF NOT EXISTS "original_unit_price" numeric(15,2),
        ADD COLUMN IF NOT EXISTS "discount_percent" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "discount_amount" numeric(15,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "is_discount_excluded" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "refunded_quantity" numeric(15,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "refunded_amount" numeric(15,2) NOT NULL DEFAULT 0
    `);

    // Initialize original_unit_price = unit_price for existing order items
    await queryRunner.query(`
      UPDATE "customer_order_items"
      SET "original_unit_price" = "unit_price"
      WHERE "original_unit_price" IS NULL
    `);

    // 7. Add permissions for Loyalty Management
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "name", "resource", "action", "is_system")
      VALUES
        (uuid_generate_v4(), 'LOYALTY_VIEW', 'loyalty', 'read', true),
        (uuid_generate_v4(), 'LOYALTY_MANAGE', 'loyalty', 'write', true)
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
      SELECT uuid_generate_v4(), r."id", p."id"
      FROM "roles" r
      CROSS JOIN "permissions" p
      WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN')
        AND p."name" IN ('LOYALTY_VIEW', 'LOYALTY_MANAGE')
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
      WHERE rp."permission_id" = p."id" AND p."name" IN ('LOYALTY_VIEW', 'LOYALTY_MANAGE')
    `);
    await queryRunner.query(`
      DELETE FROM "permissions" WHERE "name" IN ('LOYALTY_VIEW', 'LOYALTY_MANAGE')
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_order_items"
        DROP COLUMN IF EXISTS "refunded_amount",
        DROP COLUMN IF EXISTS "refunded_quantity",
        DROP COLUMN IF EXISTS "is_discount_excluded",
        DROP COLUMN IF EXISTS "discount_amount",
        DROP COLUMN IF EXISTS "discount_percent",
        DROP COLUMN IF EXISTS "original_unit_price"
    `);

    await queryRunner.query(`
      ALTER TABLE "customer_orders"
        DROP COLUMN IF EXISTS "refunded_amount",
        DROP COLUMN IF EXISTS "loyalty_tier_name",
        DROP COLUMN IF EXISTS "loyalty_tier_id",
        DROP COLUMN IF EXISTS "loyalty_discount_amount",
        DROP COLUMN IF EXISTS "loyalty_discount_percent",
        DROP COLUMN IF EXISTS "subtotal_amount"
    `);

    await queryRunner.query(`
      ALTER TABLE "customers"
        DROP CONSTRAINT IF EXISTS "FK_customers_manual_tier",
        DROP CONSTRAINT IF EXISTS "FK_customers_loyalty_tier",
        DROP COLUMN IF EXISTS "total_quantity_purchased",
        DROP COLUMN IF EXISTS "completed_orders_count",
        DROP COLUMN IF EXISTS "lifetime_spending",
        DROP COLUMN IF EXISTS "tier_override_notes",
        DROP COLUMN IF EXISTS "tier_override_expiry",
        DROP COLUMN IF EXISTS "manual_tier_override_id",
        DROP COLUMN IF EXISTS "loyalty_tier_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "customer_order_refunds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loyalty_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loyalty_tiers"`);
  }
}

