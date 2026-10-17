import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDescriptions1787581192329 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    await Promise.resolve();
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    await Promise.resolve();
  }
}
