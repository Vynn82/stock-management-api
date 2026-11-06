import { MigrationInterface, QueryRunner } from 'typeorm';

/** A customer-order payment can carry a photo of the transaction (optional). */
export class AddPaymentProofImage1793000000000 implements MigrationInterface {
  name = 'AddPaymentProofImage1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_order_payments"
        ADD COLUMN "proof_image_url" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_order_payments"
        DROP COLUMN "proof_image_url"
    `);
  }
}
