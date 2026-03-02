/**
 * E2E: Globals API (POST /launches/:id/globals, GET /widgets/globals).
 * Tests upload, retrieval, empty response, and global attachments.
 * Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

describe('E2E: Globals API', () => {
  let app: Express;
  let launchId: string;

  beforeAll(async () => {
    app = await getAppForTest();
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'Globals E2E Launch', environment: 'e2e-globals' })
      .expect(201);
    launchId = createRes.body.data.id;

    await request(app)
      .post(`/api/v1/launches/${launchId}/results`)
      .set('Content-Type', 'application/json')
      .send([
        {
          id: randomUUID(),
          name: 'Globals E2E Test',
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
        }
      ])
      .expect(201);
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('GET /api/v1/widgets/globals (empty)', () => {
    it('returns 200 with valid empty PluginGlobals when no data in DB', async () => {
      const res = await request(app)
        .get('/api/v1/widgets/globals')
        .query({ launch_id: launchId })
        .expect(200);

      const wrapper = res.body.data ?? res.body;
      const data = wrapper?.data ?? wrapper;
      expect(typeof data).toBe('object');
      expect(data).not.toBeNull();
      expect(data).toHaveProperty('errors');
      expect(data).toHaveProperty('attachments');
      expect(Array.isArray(data.errors)).toBe(true);
      expect(Array.isArray(data.attachments)).toBe(true);
      expect(data.errors).toHaveLength(0);
      expect(data.attachments).toHaveLength(0);
    });
  });

  describe('POST /api/v1/launches/:launch_id/globals', () => {
    it('saves exitCode and errors, returns 200', async () => {
      await request(app)
        .post(`/api/v1/launches/${launchId}/globals`)
        .set('Content-Type', 'application/json')
        .send({
          exitCode: { original: 1, actual: 0 },
          errors: [
            { message: 'E2E global error', trace: 'at test', actual: 'fail', expected: 'pass' }
          ]
        })
        .expect(200);
    });

    it('returns 404 for non-existent launch', async () => {
      const fakeId = randomUUID();
      await request(app)
        .post(`/api/v1/launches/${fakeId}/globals`)
        .set('Content-Type', 'application/json')
        .send({ exitCode: { original: 0 } })
        .expect(404);
    });
  });

  describe('GET /api/v1/widgets/globals (populated)', () => {
    it('returns saved exitCode, errors, and attachments', async () => {
      const res = await request(app)
        .get('/api/v1/widgets/globals')
        .query({ launch_id: launchId })
        .expect(200);

      const wrapper = res.body.data ?? res.body;
      const data = wrapper?.data ?? wrapper;
      expect(data).toHaveProperty('exitCode');
      expect(data.exitCode).toEqual({ original: 1, actual: 0 });
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0]).toMatchObject({
        message: 'E2E global error',
        actual: 'fail',
        expected: 'pass'
      });
      expect(data.attachments).toBeDefined();
      expect(Array.isArray(data.attachments)).toBe(true);
    });
  });

  describe('Global attachments', () => {
    it('GET /widgets/globals includes global attachments when uploaded without testResultId', async () => {
      const uploadRes = await request(app)
        .post(`/api/v1/launches/${launchId}/attachments`)
        .attach('file', Buffer.from('E2E global attachment content'), 'global-e2e.txt')
        .expect(201);

      const res = await request(app)
        .get('/api/v1/widgets/globals')
        .query({ launch_id: launchId })
        .expect(200);

      const wrapper = res.body.data ?? res.body;
      const data = wrapper?.data ?? wrapper;
      expect(data.attachments).toBeDefined();
      expect(Array.isArray(data.attachments)).toBe(true);
      expect(data.attachments.length).toBeGreaterThanOrEqual(1);
      const attachment = data.attachments.find((a: { name?: string }) =>
        a.name?.includes('global-e2e') || a.originalFileName?.includes('global-e2e')
      );
      expect(attachment).toBeDefined();
      expect(attachment).toHaveProperty('id');
      expect(attachment).toHaveProperty('ext');
    });
  });
});
