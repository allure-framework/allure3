import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDataColumn1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_data_gin;`);
    await queryRunner.query(`ALTER TABLE test_results DROP COLUMN IF EXISTS data;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE test_results ADD COLUMN IF NOT EXISTS data JSONB;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_results_data_gin
      ON test_results USING GIN(data) WHERE data IS NOT NULL;
    `);
  }
}
