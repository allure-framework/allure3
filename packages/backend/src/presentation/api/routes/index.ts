import { Router } from 'express';
import { LaunchController } from '../controllers/LaunchController.js';
import { TestResultController } from '../controllers/TestResultController.js';
import { AttachmentController } from '../controllers/AttachmentController.js';
import { WidgetController } from '../controllers/WidgetController.js';
import { TreeController } from '../controllers/TreeController.js';
import { ReportController } from '../controllers/ReportController.js';
import { createLaunchRoutes } from './launches.routes.js';
import { createTestResultRoutes } from './test-results.routes.js';
import { createAttachmentRoutes } from './attachments.routes.js';
import { createWidgetRoutes } from './widgets.routes.js';
import { createTreeRoutes } from './trees.routes.js';
import { createReportRoutes } from './reports.routes.js';

export function createApiRoutes(
  launchController: LaunchController,
  testResultController: TestResultController,
  attachmentController: AttachmentController,
  widgetController: WidgetController,
  treeController: TreeController,
  reportController: ReportController
): Router {
  const router = Router();
  
  // Rate limiting disabled for internal network debugging
  
  // Mount route modules
  // Note: Routes are mounted at root level, so paths in route files are relative to /api/v1
  // IMPORTANT: Mount launches routes with explicit path to ensure correct route matching
  // This ensures GET /launches matches before GET /:launch_id
  router.use('/launches', createLaunchRoutes(launchController));
  router.use(createTestResultRoutes(testResultController));
  router.use(createAttachmentRoutes(attachmentController));
  router.use(createWidgetRoutes(widgetController));
  router.use(createTreeRoutes(treeController));
  router.use(createReportRoutes(reportController));
  
  return router;
}
