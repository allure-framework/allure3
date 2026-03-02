import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Indexes for test_results table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_results_launch_id 
      ON test_results(launch_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_results_history_id 
      ON test_results(history_id) WHERE history_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_results_status 
      ON test_results(status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_results_start_time 
      ON test_results(start_time) WHERE start_time IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_results_environment 
      ON test_results(environment) WHERE environment IS NOT NULL;
    `);

    // GIN index for JSONB data column (skip if column was removed by sync or doesn't exist)
    const hasDataCol = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'test_results' AND column_name = 'data' LIMIT 1
    `);
    if (hasDataCol && (hasDataCol as unknown[]).length > 0) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_test_results_data_gin 
        ON test_results USING GIN(data) WHERE data IS NOT NULL;
      `);
    }

    // Indexes for labels table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_labels_test_result_id 
      ON labels(test_result_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_labels_name_value 
      ON labels(name, value);
    `);

    // Indexes for parameters table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_parameters_test_result_id 
      ON parameters(test_result_id);
    `);

    // Indexes for links table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_links_test_result_id 
      ON links(test_result_id);
    `);

    // Indexes for steps table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_steps_test_result_id 
      ON steps(test_result_id) WHERE test_result_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_steps_parent_step_id 
      ON steps(parent_step_id) WHERE parent_step_id IS NOT NULL;
    `);

    // Indexes for attachments table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attachments_test_result_id 
      ON attachments(test_result_id) WHERE test_result_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attachments_uid 
      ON attachments(uid);
    `);

    // Indexes for history table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_history_history_id 
      ON history(history_id, start_time DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_history_test_result_id 
      ON history(test_result_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_history_launch_id 
      ON history(launch_id);
    `);

    // Indexes for retries table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_retries_test_result_id 
      ON retries(test_result_id);
    `);

    // Indexes for aggregated_data table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_aggregated_data_launch_id 
      ON aggregated_data(launch_id) WHERE launch_id IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_aggregated_data_type_name 
      ON aggregated_data(type, name);
    `);

    // Indexes for launches table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_launches_start_time 
      ON launches(start_time);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_launches_stop_time 
      ON launches(stop_time) WHERE stop_time IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_launches_stop_time;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_launches_start_time;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_aggregated_data_type_name;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_aggregated_data_launch_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_retries_test_result_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_history_launch_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_history_test_result_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_history_history_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_attachments_uid;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_attachments_test_result_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_steps_parent_step_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_steps_test_result_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_links_test_result_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parameters_test_result_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_labels_name_value;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_labels_test_result_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_data_gin;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_environment;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_start_time;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_history_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_launch_id;`);
  }
}
