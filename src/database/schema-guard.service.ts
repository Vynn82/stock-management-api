import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Safety net for additive schema changes.
 *
 * `synchronize` is off, so a new entity column only exists once its migration
 * has been run. When the code is deployed before `npm run migration:run`,
 * every query on that table fails ("column ... does not exist") - including
 * the Telegram mini app's Place Order. This adds the missing pieces on start-up
 * instead. Everything here is idempotent (IF NOT EXISTS), additive and
 * nullable, so it is safe to run on every boot and does not conflict with the
 * matching migrations.
 */
@Injectable()
export class SchemaGuardService implements OnModuleInit {
  private readonly logger = new Logger(SchemaGuardService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    const statements = [
      // Photo of a payment transaction (kept for the external platform / staff imports).
      `ALTER TABLE "customer_order_payments" ADD COLUMN IF NOT EXISTS "proof_image_url" text`,
      // Direct Stock In / Stock Out are labelled as such in the history (null = plain adjustment).
      `ALTER TABLE "stock_adjustments" ADD COLUMN IF NOT EXISTS "movement_type" character varying(20)`,
      // Staff phones registered for push notifications.
      `CREATE TABLE IF NOT EXISTS "device_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token" text NOT NULL,
        "platform" character varying(20) NOT NULL DEFAULT 'android',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_tokens_id" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_device_tokens_token" ON "device_tokens" ("token")`,
      `CREATE INDEX IF NOT EXISTS "IDX_device_tokens_user_id" ON "device_tokens" ("user_id")`,
    ];

    for (const sql of statements) {
      try {
        await this.dataSource.query(sql);
      } catch (error) {
        // Never block start-up: log it and let the normal migration path handle it.
        this.logger.warn(
          `Schema guard skipped a statement: ${(error as Error).message}`,
        );
      }
    }
  }
}
