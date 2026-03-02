import { Attachment } from '../../../../domain/entities/Attachment.js';
import { AttachmentId } from '../../../../domain/value-objects/AttachmentId.js';
import { AttachmentEntity } from '../../entities/AttachmentEntity.js';
import { randomUUID } from 'crypto';

export interface AttachmentEntityMetadata {
  launchId?: string;
  testResultId?: string;
  stepId?: string;
}

export class AttachmentMapper {
  static toEntity(
    domain: Attachment,
    metadata?: AttachmentEntityMetadata
  ): AttachmentEntity {
    const entity = new AttachmentEntity();
    entity.id = domain.getId().getValue();
    entity.uid = domain.getUid();
    entity.name = domain.getName();
    entity.contentType = domain.getContentType();
    entity.contentLength = domain.getContentLength();
    entity.storagePath = domain.getStoragePath();
    entity.originalFileName = domain.getOriginalFileName();
    entity.testResultId = metadata?.testResultId ?? null;
    entity.stepId = metadata?.stepId ?? null;
    entity.launchId = metadata?.launchId ?? null;

    return entity;
  }

  static toDomain(entity: AttachmentEntity): Attachment {
    const id = new AttachmentId(entity.id);
    return new Attachment(
      id,
      entity.uid,
      entity.name,
      entity.contentType,
      entity.contentLength,
      entity.storagePath,
      entity.originalFileName
    );
  }
}
