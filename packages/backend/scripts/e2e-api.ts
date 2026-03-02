#!/usr/bin/env node
/**
 * E2E: upload results + GET all results. Run with tsx (avoids PnP path resolution).
 * Prerequisites: Postgres up (docker-compose up -d postgres), migrations applied (yarn migration:run).
 * Usage: cd packages/backend && yarn test:e2e:run
 */
process.env.VITEST = 'true';

import { randomUUID } from 'crypto';
import request from 'supertest';

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

async function run() {
  console.log('E2E: connecting and loading app...');
  const { getAppForTest, AppDataSource } = await import('../src/index.js');
  const app = await getAppForTest();
  let launchId: string;

  try {
    let res = await request(app).get('/health');
    if (res.status !== 200 || res.body?.status !== 'ok') throw new Error(`Health failed: ${res.status}`);
    console.log('  GET /health ok');

    res = await request(app).post('/api/v1/launches').send({ name: 'E2E Launch', environment: 'e2e' });
    if (res.status !== 201) throw new Error(`Create launch failed: ${res.status} ${JSON.stringify(res.body)}`);
    launchId = res.body?.data?.id;
    if (!launchId) throw new Error('No launch id in response');
    console.log('  POST /api/v1/launches ok, launchId:', launchId);

    const payload = [
      minimalTestResult({ name: 'Test A', status: 'passed' }),
      minimalTestResult({ name: 'Test B', status: 'failed' })
    ];
    res = await request(app)
      .post(`/api/v1/launches/${launchId}/results`)
      .set('Content-Type', 'application/json')
      .send(payload);
    if (res.status !== 201) throw new Error(`Upload results failed: ${res.status} ${JSON.stringify(res.body)}`);
    if (res.body?.data?.uploadedCount !== 2) throw new Error(`Expected uploadedCount 2, got ${res.body?.data?.uploadedCount}`);
    console.log('  POST /api/v1/launches/:id/results ok');

    res = await request(app).get(`/api/v1/launches/${launchId}/results`);
    if (res.status !== 200) throw new Error(`Get results failed: ${res.status}`);
    if (!Array.isArray(res.body?.data) || res.body.data.length !== 2) throw new Error(`Expected 2 results, got ${res.body?.data?.length}`);
    if (res.body?.total !== 2) throw new Error(`Expected total 2, got ${res.body?.total}`);
    console.log('  GET /api/v1/launches/:id/results ok');

    res = await request(app).get(`/api/v1/launches/${launchId}`);
    if (res.status !== 200) throw new Error(`Get launch failed: ${res.status}`);
    if (res.body?.data?.statistic?.passed + res.body?.data?.statistic?.failed !== 2)
      throw new Error(`Expected statistic total 2, got ${JSON.stringify(res.body?.data?.statistic)}`);
    if (res.body?.data?.testResultsCount !== 2) throw new Error(`Expected testResultsCount 2, got ${res.body?.data?.testResultsCount}`);
    console.log('  GET /api/v1/launches/:id ok');

    res = await request(app).get('/api/v1/launches');
    if (res.status !== 200) throw new Error(`List launches failed: ${res.status}`);
    const found = res.body?.data?.find((l: { id: string }) => l.id === launchId);
    if (!found) throw new Error('Created launch not found in list');
    console.log('  GET /api/v1/launches ok');

    console.log('E2E: all checks passed.');
  } finally {
    const { AppDataSource } = await import('../src/config/database.js');
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

run().catch((err) => {
  console.error('E2E failed:', err.message || err);
  process.exit(1);
});
