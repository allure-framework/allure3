import { Attachment } from '../../domain/entities/Attachment.js';
import { AttachmentResponse } from '../dto/responses/AttachmentResponse.js';
import { AttachmentId } from '../../domain/value-objects/AttachmentId.js';

export class AttachmentAdapter {
  static toDTO(domain: Attachment, baseUrl: string = ''): AttachmentResponse {
    return {
      id: domain.getId().getValue(),
      uid: domain.getUid(),
      name: domain.getName(),
      contentType: domain.getContentType(),
      contentLength: domain.getContentLength(),
      url: `${baseUrl}/api/v1/attachments/${domain.getUid()}`
    };
  }

  static toDomain(
    id: AttachmentId,
    uid: string,
    name: string | null,
    contentType: string | null,
    contentLength: number | null,
    storagePath: string | null,
    originalFileName: string | null
  ): Attachment {
    return new Attachment(id, uid, name, contentType, contentLength, storagePath, originalFileName);
  }
}
