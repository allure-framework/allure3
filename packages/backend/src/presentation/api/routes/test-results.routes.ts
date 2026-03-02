import express, { Router } from 'express';
import { TestResultController } from '../controllers/TestResultController.js';
import { parsePagination } from '../middleware/pagination.js';
import { parseFilters } from '../middleware/filtering.js';
import { validateUUID } from '../middleware/uuidValidation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const UPLOAD_BODY_LIMIT = 50 * 1024 * 1024;

const uploadRawParser = express.raw({ type: 'application/json', limit: UPLOAD_BODY_LIMIT });

/** After express.raw(), body is a Buffer. We parse it and assign back to req.body for downstream middleware. */
const parseUploadBody = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const rawBody = req.body as unknown;
  if (!Buffer.isBuffer(rawBody)) return next(new Error('Upload route expected raw body'));
  try {
    req.body = JSON.parse(rawBody.toString('utf8')) as express.Request['body'];
    next();
  } catch (e) {
    next(e);
  }
};

export function createTestResultRoutes(testResultController: TestResultController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/results:
   *   post:
   *     summary: Upload test results to a launch
   *     tags: [Test Results]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: array
   *             items:
   *               type: object
   *               required:
   *                 - id
   *                 - name
   *                 - status
   *               properties:
   *                 id:
   *                   type: string
   *                 name:
   *                   type: string
   *                 fullName:
   *                   type: string
   *                 status:
   *                   type: string
   *                   enum: [passed, failed, broken, skipped, unknown]
   *     responses:
   *       201:
   *         description: Test results uploaded successfully
   *       400:
   *         description: Validation error
   *       404:
   *         description: Launch not found
   */
  router.post(
    '/launches/:launch_id/results',
    uploadRawParser,
    parseUploadBody,
    validateUUID('launch_id'),
    asyncHandler(testResultController.upload.bind(testResultController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/results:
   *   get:
   *     summary: List test results for a launch
   *     tags: [Test Results]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [passed, failed, broken, skipped, unknown]
   *     responses:
   *       200:
   *         description: List of test results
   *       400:
   *         description: Invalid UUID format
   *       404:
   *         description: Launch not found
   */
  router.get(
    '/launches/:launch_id/results',
    validateUUID('launch_id'),
    parsePagination,
    parseFilters,
    asyncHandler(testResultController.list.bind(testResultController))
  );

  /**
   * @swagger
   * /api/v1/test-results/search:
   *   get:
   *     summary: Search test results
   *     tags: [Test Results]
   *     parameters:
   *       - in: query
   *         name: query
   *         schema:
   *           type: string
   *         description: Search query
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [passed, failed, broken, skipped, unknown]
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: Search results
   */
  router.get(
    '/test-results/search',
    parsePagination,
    parseFilters,
    asyncHandler(testResultController.search.bind(testResultController))
  );

  /**
   * @swagger
   * /api/v1/test-env-groups/{testCaseId}:
   *   get:
   *     summary: Get test env group by test case ID
   *     tags: [Test Results]
   *     parameters:
   *       - in: path
   *         name: testCaseId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Test env group (env -> testResultId mapping)
   *       400:
   *         description: Missing launch_id
   *       404:
   *         description: Test env group not found
   */
  router.get(
    '/test-env-groups/:testCaseId',
    asyncHandler(testResultController.getTestEnvGroupById.bind(testResultController))
  );

  /**
   * @swagger
   * /api/v1/test-results/{id}:
   *   get:
   *     summary: Get test result by ID
   *     tags: [Test Results]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Test result details
   *       400:
   *         description: Invalid UUID format
   *       404:
   *         description: Test result not found
   */
  router.get(
    '/test-results/:id',
    validateUUID('id'),
    asyncHandler(testResultController.getById.bind(testResultController))
  );

  /**
   * @swagger
   * /api/v1/test-results/{id}/history:
   *   get:
   *     summary: Get test result history
   *     tags: [Test Results]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *     responses:
   *       200:
   *         description: Test result history
   *       400:
   *         description: Invalid UUID format
   *       404:
   *         description: Test result not found
   */
  router.get(
    '/test-results/:id/history',
    validateUUID('id'),
    asyncHandler(testResultController.getHistory.bind(testResultController))
  );

  return router;
}
