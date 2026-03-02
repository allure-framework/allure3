import { AppDataSource } from '../config/database.js';

async function runMigrations() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connected');

    console.log('Running migrations...');
    const migrations = await AppDataSource.runMigrations();
    console.log(`Successfully ran ${migrations.length} migration(s):`);
    migrations.forEach((migration) => {
      console.log(`  - ${migration.name}`);
    });

    await AppDataSource.destroy();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();
