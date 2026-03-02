/**
 * Load .env before any test (and before app/database modules).
 * Ensures DB_* are set when Vitest runs e2e tests.
 * Prefer cwd so "cd packages/backend && yarn test:e2e" always finds .env.
 */
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPathCwd = join(process.cwd(), '.env');
const envPathCwdBackend = join(process.cwd(), 'packages', 'backend', '.env');
const envPathFromFile = join(__dirname, '..', '.env');

const pathToLoad = [envPathCwd, envPathCwdBackend, envPathFromFile].find(p => existsSync(p));
if (pathToLoad) {
  config({ path: pathToLoad });
}
