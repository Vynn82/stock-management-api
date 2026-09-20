import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class CreateRoleMenus1788066000000 implements MigrationInterface {
  name = 'CreateRoleMenus1788066000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'role_menus',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'role_id',
            type: 'uuid',
          },
          {
            name: 'menu_id',
            type: 'uuid',
          },
        ],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'role_menus',
      new TableUnique({
        name: 'UQ_role_menus_role_menu',
        columnNames: ['role_id', 'menu_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'role_menus',
      new TableForeignKey({
        name: 'FK_role_menus_role',
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'role_menus',
      new TableForeignKey({
        name: 'FK_role_menus_menu',
        columnNames: ['menu_id'],
        referencedTableName: 'menus',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('role_menus', 'FK_role_menus_menu');

    await queryRunner.dropForeignKey('role_menus', 'FK_role_menus_role');

    await queryRunner.dropUniqueConstraint(
      'role_menus',
      'UQ_role_menus_role_menu',
    );

    await queryRunner.dropTable('role_menus');
  }
}
