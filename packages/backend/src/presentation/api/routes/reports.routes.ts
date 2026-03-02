import { Router } from 'express';
import { ReportController } from '../controllers/ReportController.js';
import { validateUUID } from '../middleware/uuidValidation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function createReportRoutes(reportController: ReportController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/reports/generate:
   *   post:
   *     summary: Generate report for a launch
   *     tags: [Reports]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Report generated successfully
   *       400:
   *         description: Invalid UUID
   *       404:
   *         description: Launch not found
   */
  router.post(
    '/launches/:launch_id/reports/generate',
    validateUUID('launch_id'),
    asyncHandler(reportController.generate.bind(reportController))
  );

  /**
   * @swagger
   * /api/v1/reports/{report_uuid}:
   *   get:
   *     summary: Get report metadata by UUID
   *     tags: [Reports]
   *     parameters:
   *       - in: path
   *         name: report_uuid
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Report metadata
   *       404:
   *         description: Report not found
   */
  router.get(
    '/reports/:report_uuid',
    asyncHandler(reportController.getById.bind(reportController))
  );

  /**
   * @swagger
   * /api/v1/reports/{report_uuid}/download:
   *   get:
   *     summary: Download report file
   *     tags: [Reports]
   *     parameters:
   *       - in: path
   *         name: report_uuid
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Report file content
   *       404:
   *         description: Report not found
   */
  router.get(
    '/reports/:report_uuid/download',
    asyncHandler(reportController.download.bind(reportController))
  );

  return router;
}
