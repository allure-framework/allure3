/**
 * E2E tests: parent launch, run_key, environment_name, GET environments, aggregation by parent.
 * Verifies:
 * - Creating root with run_key and children with run_key + environment_name.
 * - Uploading results to child launches; fetching by parent returns all child results.
 * - GET /launches/:id/environments returns children (or self when no children).
 * - Optional ?environment=childId filters to that child.
 * Requires: DB running, migrations applied. Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

describe('E2E: Parent launch, run_key, environments, aggregation', () => {
  let app: Express;
  let parentId: string;
  let child1Id: string;
  let child2Id: string;
  const runKey = `e2e-run-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    app = await getAppForTest();

    // 1) Create root launch (parent) with run_key only
    const rootRes = await request(app)
      .post('/api/v1/launches')
      .send({ run_key: runKey, name: 'E2E Parent Run' })
      .expect(201);
    parentId = rootRes.body.data.id;
    expect(parentId).toMatch(UUID_REGEX);

    // 2) Create child N1 via run_key + environment_name
    const child1Res = await request(app)
      .post('/api/v1/launches')
      .send({ run_key: runKey, environment_name: 'N1' })
      .expect(201);
    child1Id = child1Res.body.data.id;
    expect(child1Id).toMatch(UUID_REGEX);
    expect(child1Id).not.toBe(parentId);

    // 3) Upload results to child N1
    await request(app)
      .post(`/api/v1/launches/${child1Id}/results`)
      .set('Content-Type', 'application/json')
      .send([
        minimalTestResult({ name: 'N1 Test A', status: 'passed' }),
        minimalTestResult({ name: 'N1 Test B', status: 'failed' })
      ])
      .expect(201);

    // 4) Create child N2 via run_key + environment_name
    const child2Res = await request(app)
      .post('/api/v1/launches')
      .send({ run_key: runKey, environment_name: 'N2' })
      .expect(201);
    child2Id = child2Res.body.data.id;
    expect(child2Id).toMatch(UUID_REGEX);
    expect(child2Id).not.toBe(parentId);
    expect(child2Id).not.toBe(child1Id);

    // 5) Upload results to child N2
    await request(app)
      .post(`/api/v1/launches/${child2Id}/results`)
      .set('Content-Type', 'application/json')
      .send([
        minimalTestResult({ name: 'N2 Test A', status: 'passed' }),
        minimalTestResult({ name: 'N2 Test B', status: 'passed' }),
        minimalTestResult({ name: 'N2 Test C', status: 'skipped' })
      ])
      .expect(201);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('GET /launches/:parent_id/environments returns child launches as environments', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${parentId}/environments`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    const data = res.body.data as Array<{ id: string; name: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    const byName = Object.fromEntries(data.map((e) => [e.name, e.id]));
    expect(byName['N1']).toBe(child1Id);
    expect(byName['N2']).toBe(child2Id);
  });

  it('GET /launches/:parent_id/results returns all results from child launches', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${parentId}/results`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total', 5);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(5);
    const names = (res.body.data as Array<{ name: string }>).map((r) => r.name);
    expect(names).toContain('N1 Test A');
    expect(names).toContain('N1 Test B');
    expect(names).toContain('N2 Test A');
    expect(names).toContain('N2 Test B');
    expect(names).toContain('N2 Test C');
  });

  it('GET /launches/:parent_id/results?environment=child1_id returns only N1 results', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${parentId}/results`)
      .query({ environment: child1Id })
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.length).toBe(2);
    const names = (res.body.data as Array<{ name: string }>).map((r) => r.name);
    expect(names).toContain('N1 Test A');
    expect(names).toContain('N1 Test B');
    expect(names).not.toContain('N2 Test A');
  });

  it('GET /launches/:parent_id/results?environment=child2_id returns only N2 results', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${parentId}/results`)
      .query({ environment: child2Id })
      .expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data.length).toBe(3);
    const names = (res.body.data as Array<{ name: string }>).map((r) => r.name);
    expect(names).toContain('N2 Test A');
    expect(names).toContain('N2 Test B');
    expect(names).toContain('N2 Test C');
  });

  it('GET /trees/suites?launch_id=parent_id aggregates all children', async () => {
    const res = await request(app)
      .get('/api/v1/trees/suites')
      .query({ launch_id: parentId })
      .expect(200);
    const tree = res.body.data as { root?: { statistic?: { total?: number } } };
    expect(tree?.root?.statistic?.total).toBe(5);
  });

  it('GET /trees/suites?launch_id=parent_id&environment=child1_id only N1 results', async () => {
    const res = await request(app)
      .get('/api/v1/trees/suites')
      .query({ launch_id: parentId, environment: child1Id })
      .expect(200);
    const tree = res.body.data as { root?: { statistic?: { total?: number } } };
    expect(tree?.root?.statistic?.total).toBe(2);
  });

  it('GET /widgets/summary?launch_id=parent_id aggregates all children', async () => {
    const res = await request(app)
      .get('/api/v1/widgets/summary')
      .query({ launch_id: parentId })
      .expect(200);
    const wrapper = res.body.data as { data?: { statistic?: { total?: number } }; statistic?: { total?: number } };
    const payload = wrapper?.data ?? wrapper;
    const stat = payload?.statistic ?? payload;
    expect(stat?.total).toBe(5);
  });

  it('GET /widgets/summary?launch_id=parent_id&environment=child2_id only N2 results', async () => {
    const res = await request(app)
      .get('/api/v1/widgets/summary')
      .query({ launch_id: parentId, environment: child2Id })
      .expect(200);
    const wrapper = res.body.data as { data?: { statistic?: { total?: number } }; statistic?: { total?: number } };
    const payload = wrapper?.data ?? wrapper;
    const stat = payload?.statistic ?? payload;
    expect(stat?.total).toBe(3);
  });

  it('GET /launches/:child_id/environments returns self when launch has no children', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${child1Id}/environments`)
      .expect(200);
    const data = res.body.data as Array<{ id: string; name: string }>;
    expect(data.length).toBe(1);
    expect(data[0].id).toBe(child1Id);
    expect(data[0].name).toBe('N1');
  });

  it('duplicate environment_name for same run_key is rejected (4xx or 5xx)', async () => {
    const res = await request(app)
      .post('/api/v1/launches')
      .send({ run_key: runKey, environment_name: 'N1' });
    expect(res.status).not.toBe(201);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('E2E: Legacy single launch (no parent/run_key) - backward compatibility', () => {
  let app: Express;
  let launchId: string;

  beforeAll(async () => {
    app = await getAppForTest();
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Legacy E2E Launch' })
      .expect(201);
    launchId = createRes.body.data.id;
    expect(launchId).toMatch(UUID_REGEX);

    await request(app)
      .post(`/api/v1/launches/${launchId}/results`)
      .set('Content-Type', 'application/json')
      .send([
        minimalTestResult({ name: 'Legacy Test 1', status: 'passed' }),
        minimalTestResult({ name: 'Legacy Test 2', status: 'passed' })
      ])
      .expect(201);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('GET /launches/:id/environments returns single environment (self) when no children', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${launchId}/environments`)
      .expect(200);
    const data = res.body.data as Array<{ id: string; name: string }>;
    expect(data.length).toBe(1);
    expect(data[0].id).toBe(launchId);
    expect(data[0].name).toBe('Legacy E2E Launch');
  });

  it('GET /launches/:id/results returns uploaded results', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${launchId}/results`)
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.length).toBe(2);
  });

  it('GET /trees/suites?launch_id=id returns correct total', async () => {
    const res = await request(app)
      .get('/api/v1/trees/suites')
      .query({ launch_id: launchId })
      .expect(200);
    const tree = res.body.data as { root?: { statistic?: { total?: number } } };
    expect(tree?.root?.statistic?.total).toBe(2);
  });
});
