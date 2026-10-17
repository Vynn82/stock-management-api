import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class UpdateCustomerTelegramAccounts1789600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new columns to customers table
    await queryRunner.query(`
      ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "contact_name" varchar(100),
      ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "rejection_reason" text;
    `);

    // Make old columns nullable if they were NOT NULL
    await queryRunner.query(`
      ALTER TABLE "customers"
      ALTER COLUMN "first_name" DROP NOT NULL,
      ALTER COLUMN "telegram_user_id" DROP NOT NULL;
    `);

    // Drop unique constraint on customers.telegram_user_id if it exists to allow 1 customer -> N telegram accounts
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_customers_telegram_user_id'
        ) THEN
          ALTER TABLE "customers" DROP CONSTRAINT "UQ_customers_telegram_user_id";
        END IF;
      END $$;
    `);

    // 2. Create customer_telegram_accounts table
    await queryRunner.createTable(
      new Table({
        name: 'customer_telegram_accounts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'telegram_user_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'telegram_chat_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'telegram_username',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'first_name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'last_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // 3. Add foreign key customer_telegram_accounts.customer_id -> customers.id
    await queryRunner.createForeignKey(
      'customer_telegram_accounts',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_customer_telegram_accounts_customer_id',
      }),
    );

    // 4. Unique Index on telegram_user_id
    await queryRunner.createIndex(
      'customer_telegram_accounts',
      new TableIndex({
        name: 'IDX_customer_telegram_accounts_telegram_user_id',
        columnNames: ['telegram_user_id'],
        isUnique: true,
      }),
    );

    // 5. Index on customer_id
    await queryRunner.createIndex(
      'customer_telegram_accounts',
      new TableIndex({
        name: 'IDX_customer_telegram_accounts_customer_id',
        columnNames: ['customer_id'],
      }),
    );

    // 6. Migrate existing customers data into customer_telegram_accounts
    await queryRunner.query(`
      INSERT INTO customer_telegram_accounts (id, customer_id, telegram_user_id, telegram_chat_id, telegram_username, first_name, last_name, created_at, updated_at)
      SELECT uuid_generate_v4(), id, telegram_user_id, telegram_chat_id, telegram_username, COALESCE(first_name, 'Customer'), last_name, created_at, updated_at
      FROM customers
      WHERE telegram_user_id IS NOT NULL
      ON CONFLICT (telegram_user_id) DO NOTHING;
    `);

    // 7. Initialize status & contact_name for existing records
    await queryRunner.query(`
      UPDATE customers SET status = 'ACTIVE' WHERE is_active = true AND status = 'PENDING';
      UPDATE customers SET contact_name = first_name WHERE contact_name IS NULL AND first_name IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('customer_telegram_accounts', true);
    await queryRunner.query(`
      ALTER TABLE "customers"
      DROP COLUMN IF EXISTS "contact_name",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "rejection_reason";
    `);
  }
}
