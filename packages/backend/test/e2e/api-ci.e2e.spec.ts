/**
 * E2E tests: GET /launches/:id/ci
 * Verifies CiDescriptor from launch executor for CiInfo widget.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('E2E: GET /launches/:id/ci', () => {
  let app: Express;
  let launchWithExecutorId: string;
  let launchWithoutExecutorId: string;

  beforeAll(async () => {
    app = await getAppForTest();

    const withExecutor = await request(app)
      .post('/api/v1/launches')
      .send({
        name: 'Launch with executor',
        executor: {
          name: 'Jenkins',
          type: 'jenkins',
          url: 'https://jenkins.example.com',
          buildName: 'Build #1',
          buildUrl: 'https://jenkins.example.com/build/1',
        },
      })
      .expect(201);
    launchWithExecutorId = withExecutor.body.data.id;
    expect(launchWithExecutorId).toMatch(UUID_REGEX);

    const withoutExecutor = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Launch without executor' })
      .expect(201);
    launchWithoutExecutorId = withoutExecutor.body.data.id;
    expect(launchWithoutExecutorId).toMatch(UUID_REGEX);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('GET /launches/:id/ci returns 200 with CiDescriptor when launch has executor', async () => {
    const res = await request(app)
      .get(`/api/v1/launches/${launchWithExecutorId}/ci`)
      .expect(200);
    expect(res.body).toHaveProperty('data');
    const ci = res.body.data;
    expect(ci.type).toBe('jenkins');
    expect(ci.jobName).toBe('Jenkins');
    expect(ci.jobUrl).toBe('https://jenkins.example.com');
    expect(ci.jobRunName).toBe('Build #1');
    expect(ci.jobRunUrl).toBe('https://jenkins.example.com/build/1');
    expect(ci.detected).toBe(false);
  });

  it('GET /launches/:id/ci returns 404 when launch has no executor', async () => {
    await request(app)
      .get(`/api/v1/launches/${launchWithoutExecutorId}/ci`)
      .expect(404);
  });

  it('GET /launches/:id/ci returns 404 for non-existent launch', async () => {
    await request(app)
      .get('/api/v1/launches/00000000-0000-0000-0000-000000000000/ci')
      .expect(404);
  });
});
