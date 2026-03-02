/**
 * E2E: Widgets required for Awesome API mode (ALLURE3_AWESOME_CHECKLIST.md).
 * These tests FAIL until the corresponding backend endpoints are implemented.
 * Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

function minimalTestResult(overrides: { id?: string; name?: string; start?: number; stop?: number } = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    name: overrides.name ?? 'Widget E2E Test',
    status: 'passed',
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    labels: [
      { name: 'host', value: 'host-1' },
      { name: 'thread', value: 'thread-1' }
    ],
    parameters: [],
    links: [],
    steps: [],
    start: overrides.start ?? Date.now() - 5000,
    stop: overrides.stop ?? Date.now(),
    sourceMetadata: { readerId: 'e2e', metadata: {} }
  };
}

describe('E2E: Widgets for Awesome API mode (TODO)', () => {
  let app: Express;
  let launchId: string;

  beforeAll(async () => {
    app = await getAppForTest();
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Widgets E2E Launch', environment: 'e2e-widgets' })
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

  it('GET /api/v1/widgets/timeline?launch_id= returns 200 with array of items (id, name, start, duration, host, thread)', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/timeline`)
      .query({ launch_id: launchId })
      .expect(200);
    const wrapper = res.body.data ?? res.body;
    const data = wrapper?.data ?? wrapper;
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const item = data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('start');
      expect(item).toHaveProperty('duration');
      expect(item).toHaveProperty('host');
      expect(item).toHaveProperty('thread');
    }
  });

  it('GET /api/v1/widgets/globals?launch_id= returns 200 with object (attachments, errors)', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/globals`)
      .query({ launch_id: launchId })
      .expect(200);
    const data = res.body.data ?? res.body;
    expect(typeof data).toBe('object');
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(false);
  });

  it('GET /api/v1/widgets/quality-gate?launch_id= returns 200 with array', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/quality-gate`)
      .query({ launch_id: launchId })
      .expect(200);
    const wrapper = res.body.data ?? res.body;
    const data = wrapper?.data ?? wrapper;
    expect(Array.isArray(data)).toBe(true);
  });

  it('GET /api/v1/widgets/allure_environment?launch_id= returns 200 with array', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/allure_environment`)
      .query({ launch_id: launchId })
      .expect(200);
    const wrapper = res.body.data ?? res.body;
    const data = wrapper?.data ?? wrapper;
    expect(Array.isArray(data)).toBe(true);
  });

  it('GET /api/v1/widgets/allure_environment returns [] when no globals', async () => {
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Allure Env Empty E2E', environment: 'e2e-allure-env' })
      .expect(201);
    const envLaunchId = createRes.body.data.id;

    const res = await request(app)
      .get('/api/v1/widgets/allure_environment')
      .query({ launch_id: envLaunchId })
      .expect(200);
    const wrapper = res.body.data ?? res.body;
    const data = wrapper?.data ?? wrapper;
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it('POST /api/v1/launches/:id/globals with allureEnvironment, GET /widgets/allure_environment returns it', async () => {
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Allure Env E2E Launch', environment: 'e2e-allure-env' })
      .expect(201);
    const envLaunchId = createRes.body.data.id;

    await request(app)
      .post(`/api/v1/launches/${envLaunchId}/globals`)
      .set('Content-Type', 'application/json')
      .send({
        allureEnvironment: [
          { name: 'browser', values: ['chrome'] },
          { name: 'url', values: ['https://example.com'] }
        ]
      })
      .expect(200);

    const res = await request(app)
      .get('/api/v1/widgets/allure_environment')
      .query({ launch_id: envLaunchId })
      .expect(200);
    const wrapper = res.body.data ?? res.body;
    const data = wrapper?.data ?? wrapper;
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data).toEqual(
      expect.arrayContaining([
        { name: 'browser', values: ['chrome'] },
        { name: 'url', values: ['https://example.com'] }
      ])
    );
  });

  it('GET /api/v1/widgets/variables?launch_id= returns 200 with object', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/variables`)
      .query({ launch_id: launchId })
      .expect(200);
    const data = res.body.data ?? res.body;
    expect(typeof data).toBe('object');
    expect(data).not.toBeNull();
  });

  it('POST /api/v1/launches with variables stores them, GET /widgets/variables returns them', async () => {
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Variables E2E Launch', variables: { build: '123', env: 'test' } })
      .expect(201);
    const varsLaunchId = createRes.body.data.id;

    const widgetRes = await request(app)
      .get('/api/v1/widgets/variables')
      .query({ launch_id: varsLaunchId })
      .expect(200);
    const wrapper = widgetRes.body.data ?? widgetRes.body;
    const data = wrapper?.data ?? wrapper;
    expect(data).not.toBeNull();
    expect(data.build).toBe('123');
    expect(data.env).toBe('test');
  });

  it('POST /api/v1/launches/:id/variables merges with existing', async () => {
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Variables Merge E2E', variables: { a: '1', b: '2' } })
      .expect(201);
    const mergeLaunchId = createRes.body.data.id;

    await request(app)
      .post(`/api/v1/launches/${mergeLaunchId}/variables`)
      .send({ b: 'overridden', c: '3' })
      .expect(200);

    const widgetRes = await request(app)
      .get('/api/v1/widgets/variables')
      .query({ launch_id: mergeLaunchId })
      .expect(200);
    const wrapper = widgetRes.body.data ?? widgetRes.body;
    const data = wrapper?.data ?? wrapper;
    expect(data.a).toBe('1');
    expect(data.b).toBe('overridden');
    expect(data.c).toBe('3');
  });

  it('GET /api/v1/widgets/tree-filters?launch_id= returns 200 with tags array', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/tree-filters`)
      .query({ launch_id: launchId })
      .expect(200);
    const wrapper = res.body.data ?? res.body;
    const data = wrapper?.data ?? wrapper;
    expect(typeof data).toBe('object');
    expect(data).toHaveProperty('tags');
    expect(Array.isArray(data.tags)).toBe(true);
  });

  it('GET /api/v1/widgets/tree-filters returns tags from labels with name=tag', async () => {
    const launchRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Tree-filters Tags E2E', environment: 'e2e-tree-filters' })
      .expect(201);
    const tagsLaunchId = launchRes.body.data.id;

    await request(app)
      .post(`/api/v1/launches/${tagsLaunchId}/results`)
      .set('Content-Type', 'application/json')
      .send([
        minimalTestResult({ name: 'Test with smoke tag' }),
        {
          ...minimalTestResult({ name: 'Test with regression tag' }),
          id: randomUUID(),
          labels: [
            { name: 'host', value: 'host-1' },
            { name: 'thread', value: 'thread-1' },
            { name: 'tag', value: 'smoke' }
          ]
        },
        {
          ...minimalTestResult({ name: 'Test with critical tag' }),
          id: randomUUID(),
          labels: [
            { name: 'host', value: 'host-1' },
            { name: 'thread', value: 'thread-1' },
            { name: 'tag', value: 'critical' }
          ]
        }
      ])
      .expect(201);

    const res = await request(app)
      .get(`/api/v1/widgets/tree-filters`)
      .query({ launch_id: tagsLaunchId })
      .expect(200);
    const wrapper = res.body.data ?? res.body;
    const data = wrapper?.data ?? wrapper;
    expect(data.tags).toContain('smoke');
    expect(data.tags).toContain('critical');
    expect(data.tags).toEqual(expect.arrayContaining(['critical', 'smoke']));
  });
});
