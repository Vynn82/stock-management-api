import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSessions1787584576309 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',

        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },

          {
            name: 'user_id',
            type: 'uuid',
          },

          {
            name: 'refresh_token_hash',
            type: 'varchar',
            length: '255',
          },

          {
            name: 'expires_at',
            type: 'timestamptz',
          },

          {
            name: 'revoked_at',
            type: 'timestamptz',
            isNullable: true,
          },

          {
            name: 'last_used_at',
            type: 'timestamptz',
            isNullable: true,
          },

          {
            name: 'user_agent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },

          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },

          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_sessions_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sessions');
  }
}
