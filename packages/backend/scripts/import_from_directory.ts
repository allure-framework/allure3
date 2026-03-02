#!/usr/bin/env node
/**
 * Import test results directly from a directory (no HTTP).
 * Reads *-result.json files and inserts into DB via UploadLaunchResults use-case.
 *
 * Usage:
 *   DATA_DIR=/path/to/allure-results yarn workspace @allurereport/backend run import-dir
 *   or: npx tsx scripts/import_from_directory.ts /path/to/allure-results
 */
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'reflect-metadata';
import { AppDataSource } from '../src/config/database.js';
import { LaunchRepository } from '../src/infrastructure/persistence/postgres/LaunchRepository.js';
import { LaunchVariablesRepository } from '../src/infrastructure/persistence/postgres/LaunchVariablesRepository.js';
import { TestResultRepository } from '../src/infrastructure/persistence/postgres/TestResultRepository.js';
import { HistoryRepository } from '../src/infrastructure/persistence/postgres/HistoryRepository.js';
import { LaunchFactory } from '../src/domain/factories/LaunchFactory.js';
import { CreateLaunch } from '../src/application/use-cases/launches/CreateLaunch.js';
import { UploadLaunchResults } from '../src/application/use-cases/test-results/UploadLaunchResults.js';
import { loadDemoResults } from '../test/fixtures/demoResults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultDemoPath = join(__dirname, '..', '..', '..', '..', 'demo', 'job_678450', 'allure-results');

const DATA_DIR = process.env.DATA_DIR || (process.argv[2] ?? (existsSync(defaultDemoPath) ? defaultDemoPath : ''));

async function main() {
  if (!DATA_DIR || !existsSync(DATA_DIR)) {
    console.error('Usage: DATA_DIR=/path/to/allure-results yarn run import-dir');
    console.error('   or: npx tsx scripts/import_from_directory.ts /path/to/allure-results');
    process.exit(1);
  }

  console.log('Data directory:', DATA_DIR);
  const results = loadDemoResults(DATA_DIR);
  console.log('Found', results.length, 'test results');
  if (results.length === 0) {
    console.log('No *-result.json files found.');
    process.exit(0);
  }

  await AppDataSource.initialize();

  const launchRepository = new LaunchRepository(AppDataSource);
  const launchVariablesRepository = new LaunchVariablesRepository(AppDataSource);
  const testResultRepository = new TestResultRepository(AppDataSource);
  const historyRepository = new HistoryRepository(AppDataSource);
  const launchFactory = new LaunchFactory();
  const createLaunch = new CreateLaunch(launchRepository, launchFactory, launchVariablesRepository);
  const uploadLaunchResults = new UploadLaunchResults(
    launchRepository,
    testResultRepository,
    historyRepository,
    undefined,
    undefined
  );

  const launchName = process.env.LAUNCH_NAME || 'Direct Import';
  const createRes = await createLaunch.execute({ name: launchName });
  const launchId = createRes.id;
  console.log('Launch created:', launchId);

  const uploadRes = await uploadLaunchResults.execute(launchId, results);
  console.log('Uploaded', uploadRes.uploadedCount, 'results');
  await AppDataSource.destroy();
  console.log('Done. View launch: http://localhost:3000/api/v1/launches/' + launchId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
