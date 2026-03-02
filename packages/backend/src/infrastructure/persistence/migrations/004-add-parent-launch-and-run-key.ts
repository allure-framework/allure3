import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentLaunchAndRunKey1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE launches
      ADD COLUMN IF NOT EXISTS parent_launch_id UUID NULL
        REFERENCES launches(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE launches
      ADD COLUMN IF NOT EXISTS run_key VARCHAR(255) NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_launches_run_key_root
      ON launches(run_key) WHERE parent_launch_id IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_launches_parent_name
      ON launches(parent_launch_id, name) WHERE parent_launch_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_launches_parent_launch_id
      ON launches(parent_launch_id) WHERE parent_launch_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_launches_parent_launch_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_launches_parent_name;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_launches_run_key_root;`);
    await queryRunner.query(`ALTER TABLE launches DROP COLUMN IF EXISTS run_key;`);
    await queryRunner.query(`ALTER TABLE launches DROP COLUMN IF EXISTS parent_launch_id;`);
  }
}
