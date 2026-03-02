import { Router } from 'express';
import multer from 'multer';
import { AttachmentController } from '../controllers/AttachmentController.js';
import { validateUUID } from '../middleware/uuidValidation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10) // 100MB default
  }
});

export function createAttachmentRoutes(attachmentController: AttachmentController): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/launches/{launch_id}/attachments:
   *   post:
   *     summary: Upload an attachment to a launch
   *     tags: [Attachments]
   *     parameters:
   *       - in: path
   *         name: launch_id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *               name:
   *                 type: string
   *               testResultId:
   *                 type: string
   *                 format: uuid
   *               stepId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Attachment uploaded successfully
   *       400:
   *         description: Invalid UUID or file required
   *       404:
   *         description: Launch not found
   */
  router.post(
    '/launches/:launch_id/attachments',
    validateUUID('launch_id'),
    upload.single('file'),
    asyncHandler(attachmentController.upload.bind(attachmentController))
  );

  /**
   * @swagger
   * /api/v1/attachments/{uid}:
   *   get:
   *     summary: Get attachment by UID
   *     tags: [Attachments]
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Attachment file content
   *       404:
   *         description: Attachment not found
   */
  router.get(
    '/attachments/:uid',
    asyncHandler(attachmentController.getById.bind(attachmentController))
  );

  /**
   * @swagger
   * /api/v1/attachments/{uid}:
   *   delete:
   *     summary: Delete attachment by UID
   *     tags: [Attachments]
   *     parameters:
   *       - in: path
   *         name: uid
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       204:
   *         description: Attachment deleted successfully
   *       404:
   *         description: Attachment not found
   */
  router.delete(
    '/attachments/:uid',
    asyncHandler(attachmentController.delete.bind(attachmentController))
  );

  return router;
}
