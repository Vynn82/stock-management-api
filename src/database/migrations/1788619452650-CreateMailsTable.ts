import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMailsTable1788619452650 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'mails',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'recipient_id',
            type: 'uuid',
          },
          {
            name: 'request_id',
            type: 'uuid',
          },
          {
            name: 'request_type',
            type: 'varchar',
          },
          {
            name: 'subject',
            type: 'varchar',
          },
          {
            name: 'message',
            type: 'text',
          },
          {
            name: 'action',
            type: 'varchar',
          },
          {
            name: 'request_url',
            type: 'varchar',
          },
          {
            name: 'is_read',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('mails');
  }
}
