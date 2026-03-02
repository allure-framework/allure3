import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
// Import entities directly (same paths as repositories) so one class reference under Vitest
import { LaunchEntity } from '../infrastructure/persistence/entities/LaunchEntity.js';
import { TestResultEntity } from '../infrastructure/persistence/entities/TestResultEntity.js';
import { LabelEntity } from '../infrastructure/persistence/entities/LabelEntity.js';
import { ParameterEntity } from '../infrastructure/persistence/entities/ParameterEntity.js';
import { LinkEntity } from '../infrastructure/persistence/entities/LinkEntity.js';
import { StepEntity } from '../infrastructure/persistence/entities/StepEntity.js';
import { RetryEntity } from '../infrastructure/persistence/entities/RetryEntity.js';
import { AttachmentEntity } from '../infrastructure/persistence/entities/AttachmentEntity.js';
import { HistoryEntity } from '../infrastructure/persistence/entities/HistoryEntity.js';
import { LaunchGlobalsEntity } from '../infrastructure/persistence/entities/LaunchGlobalsEntity.js';
import { LaunchVariablesEntity } from '../infrastructure/persistence/entities/LaunchVariablesEntity.js';

const allEntities = [
  LaunchEntity,
  TestResultEntity,
  LabelEntity,
  ParameterEntity,
  LinkEntity,
  StepEntity,
  RetryEntity,
  AttachmentEntity,
  HistoryEntity,
  LaunchGlobalsEntity,
  LaunchVariablesEntity
];

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env: when Vitest runs, cwd is reliable; otherwise try package root
const envPath = join(__dirname, '../../.env');
const envPathCwd = join(process.cwd(), '.env');
const envPathCwdBackend = join(process.cwd(), 'packages', 'backend', '.env');
const order = process.env.VITEST === 'true'
  ? [envPathCwd, envPathCwdBackend, envPath]
  : [envPath, envPathCwd, envPathCwdBackend];
const envToLoad = order.find(p => existsSync(p));
if (envToLoad) {
  config({ path: envToLoad });
} else {
  config({ path: envPath });
}

const isTest = process.env.VITEST === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'allure',
  password: process.env.DB_PASSWORD || 'allure',
  database: process.env.DB_DATABASE || 'allure_backend',
  ssl: process.env.DB_SSL === 'true',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development' && !isTest,
  entities: allEntities,
  migrations: isTest ? [] : ['src/infrastructure/persistence/migrations/**/*.ts'],
  subscribers: isTest ? [] : ['src/infrastructure/persistence/subscribers/**/*.ts']
});
