import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFulltextSearch1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tsvector column for full-text search (match TypeORM entity column name "searchVector")
    await queryRunner.query(`
      ALTER TABLE test_results 
      ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
    `);

    // Create function to update search_vector (use "searchVector" for TypeORM camelCase column name)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION test_results_search_vector_update() 
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."searchVector" := 
          setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to automatically update search_vector
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS test_results_search_vector_trigger ON test_results;
      CREATE TRIGGER test_results_search_vector_trigger
      BEFORE INSERT OR UPDATE ON test_results
      FOR EACH ROW
      EXECUTE FUNCTION test_results_search_vector_update();
    `);

    // Create GIN index on searchVector
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_test_results_search_vector 
      ON test_results USING GIN("searchVector");
    `);

    // Update existing rows
    await queryRunner.query(`
      UPDATE test_results 
      SET "searchVector" = 
        setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(full_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'C');
    `);

    // Create function for full-text search
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION search_test_results(search_query TEXT)
      RETURNS TABLE(
        id UUID,
        launch_id UUID,
        name VARCHAR,
        full_name VARCHAR,
        status VARCHAR,
        rank REAL
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          tr.id,
          tr.launch_id,
          tr.name,
          tr.full_name,
          tr.status,
          ts_rank(tr."searchVector", plainto_tsquery('english', search_query)) AS rank
        FROM test_results tr
        WHERE tr."searchVector" @@ plainto_tsquery('english', search_query)
        ORDER BY rank DESC;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS search_test_results(TEXT);`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS test_results_search_vector_trigger ON test_results;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS test_results_search_vector_update();`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_test_results_search_vector;`);
    await queryRunner.query(`ALTER TABLE test_results DROP COLUMN IF EXISTS "searchVector";`);
  }
}
