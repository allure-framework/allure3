import { Request, Response } from 'express';
import { UploadAttachment } from '../../../application/use-cases/attachments/UploadAttachment.js';
import { GetAttachment } from '../../../application/use-cases/attachments/GetAttachment.js';
import { DeleteAttachment } from '../../../application/use-cases/attachments/DeleteAttachment.js';
import { UploadAttachmentMetadata } from '../../../application/dto/requests/UploadAttachmentRequest.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { createSuccessResponse } from '../types/responses.js';

export class AttachmentController {
  constructor(
    private readonly uploadAttachment: UploadAttachment,
    private readonly getAttachment: GetAttachment,
    private readonly deleteAttachment: DeleteAttachment
  ) {}

  async upload(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    const file = req.file;
    
    if (!file) {
      res.status(400).json({
        error: 'File is required',
        code: 'FILE_REQUIRED',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const metadata: UploadAttachmentMetadata = {
      name: req.body.name || file.originalname || null,
      testResultId: req.body.testResultId || null,
      stepId: req.body.stepId || null
    };

    const attachment = await this.uploadAttachment.execute(launch_id, file, metadata);
    res.status(201).json(createSuccessResponse(attachment));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { uid } = req.params;
    const result = await this.getAttachment.execute(uid);
    
    if (!result) {
      throw new NotFoundError('Attachment', uid);
    }

    const { attachment, content } = result;
    
    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.contentLength || content.length);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.name || 'attachment'}"`);
    res.send(content);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { uid } = req.params;
    
    // First get attachment to find its ID
    const result = await this.getAttachment.execute(uid);
    if (!result) {
      throw new NotFoundError('Attachment', uid);
    }
    
    await this.deleteAttachment.execute(result.attachment.id);
    res.status(204).send();
  }
}
