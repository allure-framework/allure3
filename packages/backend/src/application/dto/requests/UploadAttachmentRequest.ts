import { z } from 'zod';

export const UploadAttachmentRequestSchema = z.object({
  name: z.string().max(1000).optional(),
  testResultId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional()
});

export type UploadAttachmentRequest = z.infer<typeof UploadAttachmentRequestSchema>;

export interface UploadAttachmentMetadata {
  name?: string;
  testResultId?: string;
  stepId?: string;
}
