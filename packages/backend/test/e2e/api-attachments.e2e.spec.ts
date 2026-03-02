/**
 * E2E tests: attachment upload, get by UID, delete.
 * Requires: DB running (docker-compose up -d postgres), migrations applied (yarn migration:run).
 * Run: cd packages/backend && yarn test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { getAppForTest } from '../../src/index.js';
import { AppDataSource } from '../../src/config/database.js';
import type { Express } from 'express';

describe('E2E: Attachments', () => {
  let app: Express;
  let launchId: string;
  let attachmentUid: string;

  beforeAll(async () => {
    app = await getAppForTest();
    const createRes = await request(app)
      .post('/api/v1/launches')
      .send({ name: 'E2E Attachments Launch', environment: 'e2e' })
      .expect(201);
    launchId = createRes.body.data.id;
    expect(launchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    const fileContent = Buffer.from('E2E attachment body', 'utf-8');
    const uploadRes = await request(app)
      .post(`/api/v1/launches/${launchId}/attachments`)
      .attach('file', fileContent, 'e2e-attachment.txt')
      .expect(201);
    attachmentUid = uploadRes.body.data.uid;
    expect(attachmentUid).toBeTruthy();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('POST /api/v1/launches/:launch_id/attachments uploads a file (format)', async () => {
    const fileContent = Buffer.from('E2E second file', 'utf-8');
    const res = await request(app)
      .post(`/api/v1/launches/${launchId}/attachments`)
      .attach('file', fileContent, 'e2e-second.txt')
      .expect(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('uid');
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data).toHaveProperty('url');
  });

  it('GET /api/v1/attachments/:uid returns attachment content', async () => {
    const res = await request(app)
      .get(`/api/v1/attachments/${attachmentUid}`)
      .buffer(true)
      .parse((resp, cb) => {
        const chunks: Buffer[] = [];
        resp.on('data', (chunk: Buffer) => chunks.push(chunk));
        resp.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toBeDefined();
    const text = Buffer.isBuffer(res.body) ? (res.body as Buffer).toString('utf-8') : String(res.body);
    expect(text).toBe('E2E attachment body');
  });

  it('GET /api/v1/attachments/:uid returns 404 for unknown uid', async () => {
    await request(app)
      .get('/api/v1/attachments/non-existent-uid-12345')
      .expect(404);
  });

  it('DELETE /api/v1/attachments/:uid removes attachment', async () => {
    await request(app)
      .delete(`/api/v1/attachments/${attachmentUid}`)
      .expect(204);
  });

  it('GET /api/v1/attachments/:uid returns 404 after delete', async () => {
    await request(app)
      .get(`/api/v1/attachments/${attachmentUid}`)
      .expect(404);
  });
});
