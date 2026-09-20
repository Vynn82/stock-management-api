import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateMenus1788065144244 implements MigrationInterface {
  name = 'CreateMenus1788065144244';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'menus',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'label',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'path',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'icon',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'parent_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sort_order',
            type: 'integer',
            default: '0',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_system',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'menus',
      new TableForeignKey({
        name: 'FK_menus_parent',
        columnNames: ['parent_id'],
        referencedTableName: 'menus',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('menus', 'FK_menus_parent');

    await queryRunner.dropTable('menus');
  }
}
