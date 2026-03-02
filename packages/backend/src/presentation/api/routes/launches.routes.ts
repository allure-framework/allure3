import { Router } from 'express';
import { LaunchController } from '../controllers/LaunchController.js';
import { validateRequest } from '../middleware/validation.js';
import { parsePagination } from '../middleware/pagination.js';
import { validateUUID } from '../middleware/uuidValidation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function createLaunchRoutes(launchController: LaunchController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/launches:
   *   post:
   *     summary: Create a new launch
   *     tags: [Launches]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 255
   *               executor:
   *                 type: object
   *               environment:
   *                 type: string
   *     responses:
   *       201:
   *         description: Launch created successfully
   *       400:
   *         description: Validation error
   */
  router.post(
    '/',
    validateRequest('createLaunch'),
    asyncHandler(launchController.create.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches:
   *   get:
   *     summary: List all launches
   *     tags: [Launches]
   *     parameters:
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
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *     responses:
   *       200:
   *         description: List of launches
   */
  router.get(
    '/',
    parsePagination,
    asyncHandler(launchController.list.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/globals:
   *   post:
   *     summary: Create or update globals for a launch
   *     tags: [Launches]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               exitCode:
   *                 type: object
   *                 properties:
   *                   original:
   *                     type: integer
   *                   actual:
   *                     type: integer
   *               errors:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                     trace:
   *                       type: string
   *     responses:
   *       200:
   *         description: Globals saved successfully
   *       404:
   *         description: Launch not found
   */
  router.post(
    '/:launch_id/globals',
    validateUUID('launch_id'),
    validateRequest('createGlobals'),
    asyncHandler(launchController.createGlobals.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/variables:
   *   post:
   *     summary: Extend or override variables for a launch
   *     tags: [Launches]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties:
   *               type: string
   *     responses:
   *       200:
   *         description: Variables saved successfully
   *       404:
   *         description: Launch not found
   */
  router.post(
    '/:launch_id/variables',
    validateUUID('launch_id'),
    validateRequest('createVariables'),
    asyncHandler(launchController.createVariables.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/environments:
   *   get:
   *     summary: Get environments for a launch (child launches or self)
   *     tags: [Launches]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: List of { id, name } for environments
   *       404:
   *         description: Launch not found
   */
  router.get(
    '/:launch_id/environments',
    validateUUID('launch_id'),
    asyncHandler(launchController.getEnvironments.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/ci:
   *   get:
   *     summary: Get CI descriptor for a launch (from executor)
   *     tags: [Launches]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: CiDescriptor for CiInfo widget
   *       404:
   *         description: Launch not found or no executor
   */
  router.get(
    '/:launch_id/ci',
    validateUUID('launch_id'),
    asyncHandler(launchController.getCi.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}:
   *   get:
   *     summary: Get launch by ID
   *     tags: [Launches]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Launch details
   *       400:
   *         description: Invalid UUID format
   *       404:
   *         description: Launch not found
   */
  router.get(
    '/:launch_id',
    validateUUID('launch_id'),
    asyncHandler(launchController.getById.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/complete:
   *   post:
   *     summary: Complete a launch
   *     tags: [Launches]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Launch completed successfully
   *       400:
   *         description: Invalid UUID format
   *       404:
   *         description: Launch not found
   */
  router.post(
    '/:launch_id/complete',
    validateUUID('launch_id'),
    asyncHandler(launchController.complete.bind(launchController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}:
   *   delete:
   *     summary: Delete a launch
   *     tags: [Launches]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       204:
   *         description: Launch deleted successfully
   *       400:
   *         description: Invalid UUID format
   *       404:
   *         description: Launch not found
   */
  router.delete(
    '/:launch_id',
    validateUUID('launch_id'),
    asyncHandler(launchController.delete.bind(launchController))
  );

  return router;
}
