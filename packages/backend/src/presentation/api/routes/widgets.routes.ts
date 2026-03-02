import { Router } from 'express';
import { WidgetController } from '../controllers/WidgetController.js';
import { validateUUID } from '../middleware/uuidValidation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function createWidgetRoutes(widgetController: WidgetController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/widgets/{name}:
   *   get:
   *     summary: Get widget data by name
   *     tags: [Widgets]
   *     parameters:
   *       - in: path
   *         name: name
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: launch_id
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Widget data
   *       404:
   *         description: Widget not found
   */
  router.get(
    '/widgets/:name',
    asyncHandler(widgetController.get.bind(widgetController))
  );

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/widgets/generate:
   *   post:
   *     summary: Generate widgets for a launch
   *     tags: [Widgets]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Widgets generated successfully
   *       400:
   *         description: Invalid UUID
   *       404:
   *         description: Launch not found
   */
  router.post(
    '/launches/:launch_id/widgets/generate',
    validateUUID('launch_id'),
    asyncHandler(widgetController.generate.bind(widgetController))
  );

  return router;
}
