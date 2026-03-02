import { IAttachmentRepository } from '../../../domain/repositories/IAttachmentRepository.js';
import { AttachmentId } from '../../../domain/value-objects/AttachmentId.js';

export interface AttachmentStorageService {
  store(file: Express.Multer.File, uid: string): Promise<string>;
  retrieve(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

export class DeleteAttachment {
  constructor(
    private readonly attachmentRepository: IAttachmentRepository,
    private readonly storageService: AttachmentStorageService
  ) {}

  async execute(attachmentId: string): Promise<void> {
    const id = new AttachmentId(attachmentId);
    const attachment = await this.attachmentRepository.findById(id);

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    const storagePath = attachment.getStoragePath();
    if (storagePath) {
      await this.storageService.delete(storagePath);
    }

    await this.attachmentRepository.delete(id);
  }
}
