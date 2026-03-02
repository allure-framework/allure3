import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'allure',
  password: process.env.DB_PASSWORD || 'allure',
  database: process.env.DB_DATABASE || 'allure_backend',
  ssl: process.env.DB_SSL === 'true',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/infrastructure/persistence/entities/**/*.ts'],
  migrations: ['migrations/**/*.ts'],
  subscribers: ['src/infrastructure/persistence/subscribers/**/*.ts']
});
