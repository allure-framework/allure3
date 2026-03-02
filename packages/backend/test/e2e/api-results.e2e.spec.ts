/**
 * E2E tests: upload results and GET all uploaded results.
 * Requires: DB running (docker-compose up -d postgres), migrations applied (yarn migration:run).
 * Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

/** Minimal TestResult DTO for upload (matches @allurereport/core-api). id must be UUID. */
function minimalTestResult(overrides: { id?: string; name?: string; status?: string } = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    name: overrides.name ?? 'E2E Test',
    status: overrides.status ?? 'passed',
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    sourceMetadata: { readerId: 'e2e', metadata: {} }
  };
}

describe('E2E: Upload results and GET all results', () => {
  let app: Express;
  let launchId: string;

  beforeAll(async () => {
    app = await getAppForTest();
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'E2E Launch', environment: 'e2e' })
      .expect(201);
    launchId = createRes.body.data.id;
    expect(launchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('dbConnected');
  });

  it('POST /api/v1/launches creates a launch (response format)', async () => {
    const res = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'E2E Launch Extra', environment: 'e2e' })
      .expect(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('name', 'E2E Launch Extra');
    expect(res.body.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('POST /api/v1/launches/:launch_id/results uploads results', async () => {
    const payload = [
      minimalTestResult({ name: 'Test A', status: 'passed' }),
      minimalTestResult({ name: 'Test B', status: 'failed' })
    ];
    const res = await request(app)
      .post(`/api/v1/launches/${launchId}/results`)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('uploadedCount', 2);
    expect(res.body.data).toHaveProperty('launchId', launchId);
  });

  it('GET /api/v1/launches/:launch_id/results returns all uploaded results', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${launchId}/results`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body).toHaveProperty('total', 2);
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('totalPages');
    const first = res.body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('status');
  });

  it('GET /api/v1/test-results/search returns 200 and array', async () => {
    const res = await request(app)
      .get('/api/v1/test-results/search')
      .query({ status: 'passed' })
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/test-results/:id/history returns 200 and structure', async () => {
    const listRes = await request(app)
      .get(`/api/v1/launches/${launchId}/results`)
      .query({ limit: 1 })
      .expect(200);
    const id = listRes.body.data[0]?.id;
    expect(id).toBeDefined();
    const res = await request(app)
      .get(`/api/v1/test-results/${id}/history`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/launches/:launch_id returns launch with statistic', async () => {
    const res = await request(app).get(`/api/v1/launches/${launchId}`).expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('id', launchId);
    expect(res.body.data).toHaveProperty('name', 'E2E Launch');
    expect(res.body.data).toHaveProperty('statistic');
    const stat = res.body.data.statistic;
    expect(stat).toHaveProperty('passed');
    expect(stat).toHaveProperty('failed');
    expect(stat.passed + stat.failed).toBe(2);
    expect(res.body.data).toHaveProperty('testResultsCount', 2);
  });

  it('GET /api/v1/launches returns list including created launch', async () => {
    const res = await request(app).get('/api/v1/launches').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((l: { id: string }) => l.id === launchId);
    expect(found).toBeDefined();
    expect(found.name).toBe('E2E Launch');
  });

  it('POST /api/v1/launches/:launch_id/complete returns 200', async () => {
    const res = await request(app)
      .post(`/api/v1/launches/${launchId}/complete`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
  });

  it('DELETE /api/v1/launches/:launch_id returns 204', async () => {
    await request(app)
      .delete(`/api/v1/launches/${launchId}`)
      .expect(204);
  });

  it('GET /api/v1/launches/:launch_id returns 404 after delete', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${launchId}`)
      .expect(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code');
  });
});
