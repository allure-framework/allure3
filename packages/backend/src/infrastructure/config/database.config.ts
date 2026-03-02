import { DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean;
  synchronize?: boolean;
  logging?: boolean;
  poolSize?: number;
}

export function getDatabaseConfig(): DataSourceOptions {
  const dbConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'allure',
    password: process.env.DB_PASSWORD || 'allure',
    database: process.env.DB_DATABASE || 'allure_backend',
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10')
  };

  return {
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    ssl: dbConfig.ssl,
    synchronize: dbConfig.synchronize,
    logging: dbConfig.logging,
    extra: {
      max: dbConfig.poolSize
    },
    entities: ['src/infrastructure/persistence/entities/**/*.ts'],
    migrations: ['src/infrastructure/persistence/migrations/**/*.ts'],
    subscribers: ['src/infrastructure/persistence/subscribers/**/*.ts']
  };
}
