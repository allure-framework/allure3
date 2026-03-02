import { beforeAll, afterAll } from 'vitest';
import { AppDataSource } from '../config/database.js';

beforeAll(async () => {
  // Инициализация тестовой БД
  await AppDataSource.initialize();
});

afterAll(async () => {
  // Закрытие соединения
  await AppDataSource.destroy();
});
