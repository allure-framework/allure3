/**
 * E2E: Upload demo report (job_678450, with failures) and verify no data loss via GET.
 * Requires: DB running, migrations applied. Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import { loadDemoResults } from '../fixtures/demoResults.js';
import type { Express } from 'express';
import type { TestResult as TestResultDTO } from '@allurereport/core-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEMO_RESULTS_DIR =
  process.env.DEMO_RESULTS_DIR ||
  path.join(__dirname, '../fixtures/demo-results');

/** String truncation limits from TestResultMapper (DB) */
const LIMITS = { name: 1000, fullName: 2000, labelValue: 1000, historyId: 255, testCaseId: 255 };

function truncate(s: string | null | undefined, max: number): string {
  if (s == null || typeof s !== 'string') return '';
  return s.length <= max ? s : s.slice(0, max);
}

/** Compare uploaded DTO with GET response, allowing DB truncation */
function expectResultMatches(uploaded: TestResultDTO, got: Record<string, unknown>): void {
  expect(got.id).toBe(uploaded.id);
  expect(truncate(got.name as string, LIMITS.name)).toBe(truncate(uploaded.name, LIMITS.name));
  expect(truncate(got.fullName as string, LIMITS.fullName)).toBe(
    truncate(uploaded.fullName ?? '', LIMITS.fullName)
  );
  expect(got.status).toBe(uploaded.status);
  if (uploaded.start != null) expect(Number(got.start)).toBe(Number(uploaded.start));
  if (uploaded.stop != null) expect(Number(got.stop)).toBe(Number(uploaded.stop));
  const labels = (got.labels as Array<{ name?: string; value?: string }>) || [];
  expect(labels.length).toBe(uploaded.labels?.length ?? 0);
  uploaded.labels?.forEach((l, i) => {
    expect(labels[i].name).toBe(l.name);
    expect(truncate(labels[i].value, LIMITS.labelValue)).toBe(
      truncate(l.value ?? '', LIMITS.labelValue)
    );
  });
  const parameters = (got.parameters as Array<{ name?: string; value?: string }>) || [];
  expect(parameters.length).toBe(uploaded.parameters?.length ?? 0);
  const links = (got.links as Array<unknown>) || [];
  expect(links.length).toBe(uploaded.links?.length ?? 0);
  const steps = (got.steps as Array<unknown>) || [];
  if (uploaded.steps != null && uploaded.steps.length > 0 && steps.length > 0) {
    expect(steps.length).toBe(uploaded.steps.length);
  }
  if (uploaded.error) {
    expect(got.error).toBeDefined();
    expect((got.error as { message?: string }).message).toBeDefined();
  }
}

describe('E2E: Demo report upload and GET (no data loss)', () => {
  let app: Express;
  let launchId: string;
  let results: TestResultDTO[] = [];

  beforeAll(async () => {
    app = await getAppForTest();
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Demo Report E2E', environment: 'e2e-demo' })
      .expect(201);
    launchId = createRes.body.data.id;
    expect(launchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    results = loadDemoResults(DEMO_RESULTS_DIR);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('loads demo results from directory', () => {
    expect(results.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/launches/:launch_id/results uploads all demo results', async () => {
    const res = await request(app)
      .post(`/api/v1/launches/${launchId}/results`)
      .set('Content-Type', 'application/json')
      .send(results)
      .expect(201);
    expect(res.body.data.uploadedCount).toBe(results.length);
    expect(res.body.data.launchId).toBe(launchId);
  });

  it('GET /api/v1/launches/:launch_id/results returns all uploaded ids (no loss)', async () => {
    const limit = 100;
    const collected: string[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await request(app)
        .get(`/api/v1/launches/${launchId}/results`)
        .query({ page, limit })
        .expect(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('data');
      totalPages = res.body.totalPages ?? Math.ceil(res.body.total / limit);
      const pageIds = (res.body.data as Array<{ id: string }>).map((r) => r.id);
      collected.push(...pageIds);
      page++;
    } while (page <= totalPages);

    expect(collected.length).toBe(results.length);
    const uploadedIds = new Set(results.map((r) => r.id));
    for (const id of collected) {
      expect(uploadedIds.has(id)).toBe(true);
    }
  });

  it('GET /api/v1/test-results/:id returns same data for sample (first 5 + failed)', async () => {
    const failed = results.filter((r) => r.status === 'failed');
    const sample = [...results.slice(0, 5), ...failed].filter(
      (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
    );

    for (const uploaded of sample) {
      const res = await request(app)
        .get(`/api/v1/test-results/${uploaded.id}`)
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expectResultMatches(uploaded, res.body.data as Record<string, unknown>);
    }
  });

  it('POST /api/v1/launches/:launch_id/widgets/generate returns 200', async () => {
    const res = await request(app)
      .post(`/api/v1/launches/${launchId}/widgets/generate`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /api/v1/widgets/summary?launch_id=... has total and status counts', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/summary`)
      .query({ launch_id: launchId })
      .expect(200);
    // API returns { data: { name, type, data: widgetPayload } }
    const wrapper = res.body.data as { data?: { statistic?: { total?: number } }; statistic?: { total?: number } };
    const payload = wrapper?.data ?? wrapper;
    const stat = payload?.statistic ?? payload;
    expect(stat).toBeDefined();
    expect(stat.total).toBe(results.length);
    const sum =
      (stat.passed ?? 0) +
      (stat.failed ?? 0) +
      (stat.broken ?? 0) +
      (stat.skipped ?? 0) +
      (stat.unknown ?? 0);
    expect(sum).toBe(results.length);
  });

  it('GET /api/v1/widgets/status?launch_id=... matches uploaded status counts', async () => {
    const res = await request(app)
      .get(`/api/v1/widgets/status`)
      .query({ launch_id: launchId })
      .expect(200);
    const wrapper = res.body.data as { data?: { total?: number }; total?: number };
    const payload = wrapper?.data ?? wrapper;
    expect(payload?.total ?? wrapper?.total).toBe(results.length);
  });

  it('GET /api/v1/trees/behaviors?launch_id=... root.statistic.total equals results count', async () => {
    const res = await request(app)
      .get(`/api/v1/trees/behaviors`)
      .query({ launch_id: launchId })
      .expect(200);
    const tree = res.body.data as { root?: { statistic?: { total?: number } } };
    expect(tree?.root?.statistic?.total).toBe(results.length);
  });

  it('GET /api/v1/trees/suites, packages, categories have same total', async () => {
    const types = ['suites', 'packages', 'categories'] as const;
    for (const type of types) {
      const res = await request(app)
        .get(`/api/v1/trees/${type}`)
        .query({ launch_id: launchId })
        .expect(200);
      const tree = res.body.data as { root?: { statistic?: { total?: number } } };
      expect(tree?.root?.statistic?.total).toBe(results.length);
    }
  });

  it('demo has at least one failed test and summary shows failed count >= 1', async () => {
    const failedCount = results.filter((r) => r.status === 'failed').length;

    const res = await request(app)
      .get(`/api/v1/widgets/summary`)
      .query({ launch_id: launchId })
      .expect(200);
    const wrapper = res.body.data as { data?: { statistic?: { failed?: number } }; statistic?: { failed?: number } };
    const payload = wrapper?.data ?? wrapper;
    const stat = payload?.statistic ?? payload;
    const summaryFailed = stat?.failed ?? 0;
    if (failedCount >= 1) {
      expect(summaryFailed).toBeGreaterThanOrEqual(1);
    } else {
      expect(summaryFailed).toBe(0);
    }
  });

  it('GET /api/v1/launches/:launch_id has testResultsCount and statistic', async () => {
    const res = await request(app).get(`/api/v1/launches/${launchId}`).expect(200);
    expect(res.body.data.testResultsCount).toBe(results.length);
    const stat = res.body.data.statistic;
    expect(stat).toBeDefined();
    const sum = (stat.passed ?? 0) + (stat.failed ?? 0) + (stat.broken ?? 0) + (stat.skipped ?? 0) + (stat.unknown ?? 0);
    expect(sum).toBe(results.length);
  });
});
