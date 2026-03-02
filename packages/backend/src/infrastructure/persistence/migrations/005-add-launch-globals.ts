import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaunchGlobals1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS launch_globals (
        launch_id UUID PRIMARY KEY REFERENCES launches(id) ON DELETE CASCADE,
        exit_code_original INTEGER NOT NULL DEFAULT 0,
        exit_code_actual INTEGER,
        errors JSONB NOT NULL DEFAULT '[]'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE attachments
      ADD COLUMN IF NOT EXISTS launch_id UUID NULL
        REFERENCES launches(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attachments_launch_id
      ON attachments(launch_id) WHERE launch_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_attachments_launch_id;`);
    await queryRunner.query(`ALTER TABLE attachments DROP COLUMN IF EXISTS launch_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS launch_globals;`);
  }
}
