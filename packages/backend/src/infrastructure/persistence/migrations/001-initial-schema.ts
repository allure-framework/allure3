import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create launches table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS launches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        stop_time TIMESTAMP,
        executor JSONB,
        environment VARCHAR(255),
        report_uuid UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create test_results table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS test_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        launch_id UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
        history_id VARCHAR(255),
        test_case_id VARCHAR(255),
        name VARCHAR(1000) NOT NULL,
        full_name VARCHAR(2000),
        status VARCHAR(50) NOT NULL CHECK (status IN ('failed', 'broken', 'passed', 'skipped', 'unknown')),
        environment VARCHAR(255),
        start_time BIGINT,
        stop_time BIGINT,
        duration BIGINT,
        description TEXT,
        description_html TEXT,
        precondition TEXT,
        precondition_html TEXT,
        expected_result TEXT,
        expected_result_html TEXT,
        flaky BOOLEAN DEFAULT FALSE,
        muted BOOLEAN DEFAULT FALSE,
        known BOOLEAN DEFAULT FALSE,
        hidden BOOLEAN DEFAULT FALSE,
        transition VARCHAR(50) CHECK (transition IN ('regressed', 'fixed', 'malfunctioned', 'new')),
        error JSONB,
        source_metadata JSONB NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create labels table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS labels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        value VARCHAR(1000),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create parameters table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS parameters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        value TEXT,
        hidden BOOLEAN DEFAULT FALSE,
        excluded BOOLEAN DEFAULT FALSE,
        masked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create links table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
        name VARCHAR(255),
        url TEXT NOT NULL,
        type VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create steps table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
        parent_step_id UUID REFERENCES steps(id) ON DELETE CASCADE,
        name VARCHAR(1000) NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('failed', 'broken', 'passed', 'skipped', 'unknown')),
        step_id VARCHAR(255),
        start_time BIGINT,
        stop_time BIGINT,
        duration BIGINT,
        error JSONB,
        message TEXT,
        trace TEXT,
        steps JSONB,
        parameters JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create attachments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
        step_id UUID REFERENCES steps(id) ON DELETE CASCADE,
        uid VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(1000),
        content_type VARCHAR(255),
        content_length BIGINT,
        storage_path TEXT,
        original_file_name VARCHAR(1000),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        history_id VARCHAR(255) NOT NULL,
        test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
        launch_id UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL CHECK (status IN ('failed', 'broken', 'passed', 'skipped', 'unknown')),
        start_time BIGINT,
        duration BIGINT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create retries table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS retries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
        retry_test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(test_result_id, retry_test_result_id)
      );
    `);

    // Create aggregated_data table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS aggregated_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        launch_id UUID REFERENCES launches(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(launch_id, type, name)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS aggregated_data;`);
    await queryRunner.query(`DROP TABLE IF EXISTS retries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS attachments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS steps;`);
    await queryRunner.query(`DROP TABLE IF EXISTS links;`);
    await queryRunner.query(`DROP TABLE IF EXISTS parameters;`);
    await queryRunner.query(`DROP TABLE IF EXISTS labels;`);
    await queryRunner.query(`DROP TABLE IF EXISTS test_results;`);
    await queryRunner.query(`DROP TABLE IF EXISTS launches;`);
  }
}
