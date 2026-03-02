import { AttachmentId } from '../value-objects/AttachmentId.js';

export class Attachment {
  constructor(
    private readonly id: AttachmentId,
    private readonly uid: string,
    private readonly name: string | null = null,
    private readonly contentType: string | null = null,
    private readonly contentLength: number | null = null,
    private readonly storagePath: string | null = null,
    private readonly originalFileName: string | null = null
  ) {
    if (!uid || uid.trim().length === 0) {
      throw new Error('Attachment UID cannot be empty');
    }
  }

  getId(): AttachmentId {
    return this.id;
  }

  getUid(): string {
    return this.uid;
  }

  getName(): string | null {
    return this.name;
  }

  getContentType(): string | null {
    return this.contentType;
  }

  getContentLength(): number | null {
    return this.contentLength;
  }

  getStoragePath(): string | null {
    return this.storagePath;
  }

  getOriginalFileName(): string | null {
    return this.originalFileName;
  }

  hasContent(): boolean {
    return this.storagePath !== null && this.contentLength !== null && this.contentLength > 0;
  }
}
