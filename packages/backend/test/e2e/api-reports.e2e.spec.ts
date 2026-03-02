/**
 * E2E: Report generation and GET/download.
 * Requires: DB running, migrations applied. Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

function minimalTestResult(overrides: { id?: string; name?: string } = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    name: overrides.name ?? 'Report E2E',
    status: 'passed',
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

describe('E2E: Reports', () => {
  let app: Express;
  let launchId: string;
  let reportUuid: string;

  beforeAll(async () => {
    app = await getAppForTest();
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'E2E Reports Launch', environment: 'e2e' })
      .expect(201);
    launchId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/launches/${launchId}/results`)
      .set('Content-Type', 'application/json')
      .send([minimalTestResult()])
      .expect(201);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('POST /api/v1/launches/:launch_id/reports/generate returns 200 and report uuid', async () => {
    const res = await request(app)
      .post(`/api/v1/launches/${launchId}/reports/generate`)
      .send({})
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('reportUuid');
    expect(res.body.data).toHaveProperty('launchId', launchId);
    expect(res.body.data).toHaveProperty('url');
    reportUuid = res.body.data.reportUuid;
    expect(reportUuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('GET /api/v1/reports/:report_uuid returns 200 or 404 with error body', async () => {
    const res = await request(app).get(`/api/v1/reports/${reportUuid}`);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('data');
    } else {
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('code');
    }
  });

  it('GET /api/v1/reports/:report_uuid/download returns 200 or 404', async () => {
    const res = await request(app).get(`/api/v1/reports/${reportUuid}/download`);
    if (res.status === 200) {
      expect(res.headers['content-type']).toBeDefined();
      expect(res.body).toBeDefined();
    } else {
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('code');
    }
  });

  it('GET /api/v1/reports/non-existent-uuid returns 404 with error and code', async () => {
    const res = await request(app)
      .get('/api/v1/reports/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('code');
  });
});
