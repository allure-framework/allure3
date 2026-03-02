import { Router } from 'express';
import { TreeController } from '../controllers/TreeController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function createTreeRoutes(treeController: TreeController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/trees/{type}:
   *   get:
   *     summary: Get tree data by type (suites, packages, behaviors)
   *     tags: [Trees]
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [suites, packages, behaviors]
   *       - in: query
   *         name: launch_id
   *         required: false
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: Tree data
   *       400:
   *         description: Invalid tree type
   */
  router.get(
    '/trees/:type',
    asyncHandler(treeController.get.bind(treeController))
  );

  return router;
}
