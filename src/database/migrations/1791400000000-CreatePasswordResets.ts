import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePasswordResets1791400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_resets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          { name: 'user_id', type: 'uuid' },
          { name: 'otp_hash', type: 'varchar', length: '255' },
          {
            name: 'reset_token_hash',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'attempts', type: 'int', default: 0 },
          { name: 'expires_at', type: 'timestamptz' },
          { name: 'verified_at', type: 'timestamptz', isNullable: true },
          { name: 'used_at', type: 'timestamptz', isNullable: true },
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
      'password_resets',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'password_resets',
      new TableIndex({
        name: 'IDX_password_resets_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'password_resets',
      new TableIndex({
        name: 'IDX_password_resets_token_hash',
        columnNames: ['reset_token_hash'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_resets');
  }
}
