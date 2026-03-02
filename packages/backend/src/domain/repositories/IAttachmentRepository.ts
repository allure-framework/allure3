import { Attachment } from '../entities/Attachment.js';
import { AttachmentId } from '../value-objects/AttachmentId.js';

export interface SaveAttachmentMetadata {
  launchId?: string;
  testResultId?: string;
  stepId?: string;
}

export interface IAttachmentRepository {
  save(attachment: Attachment, metadata?: SaveAttachmentMetadata): Promise<void>;
  findById(id: AttachmentId): Promise<Attachment | null>;
  findByUid(uid: string): Promise<Attachment | null>;
  findGlobalByLaunchIds(launchIds: string[]): Promise<Array<{ uid: string; name: string | null; contentType: string | null; originalFileName: string | null }>>;
  delete(id: AttachmentId): Promise<void>;
  exists(id: AttachmentId): Promise<boolean>;
}
