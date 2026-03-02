/**
 * E2E: Error response format (400/404 bodies with error, code).
 * Requires: DB running, migrations applied. Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

describe('E2E: Error response format', () => {
  let app: Express;

  beforeAll(async () => {
    app = await getAppForTest();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('GET /api/v1/launches/not-a-uuid returns 400 with error and code', async () => {
    const res = await request(app)
      .get('/api/v1/launches/not-a-uuid')
      .expect(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code');
    expect(typeof res.body.error).toBe('string');
    expect(typeof res.body.code).toBe('string');
  });

  it('GET /api/v1/attachments/non-existent-uid-12345 returns 404 with error and code', async () => {
    const res = await request(app)
      .get('/api/v1/attachments/non-existent-uid-12345')
      .expect(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code');
  });
});
