import { IAttachmentRepository } from '../../../domain/repositories/IAttachmentRepository.js';
import { AttachmentAdapter } from '../../adapters/AttachmentAdapter.js';
import { AttachmentResponse } from '../../dto/responses/AttachmentResponse.js';

export interface AttachmentStorageService {
  store(file: Express.Multer.File, uid: string): Promise<string>;
  retrieve(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

export class GetAttachment {
  constructor(
    private readonly attachmentRepository: IAttachmentRepository,
    private readonly storageService: AttachmentStorageService,
    private readonly baseUrl: string = ''
  ) {}

  async execute(uid: string): Promise<{ attachment: AttachmentResponse; content: Buffer } | null> {
    const attachment = await this.attachmentRepository.findByUid(uid);

    if (!attachment) {
      return null;
    }

    const storagePath = attachment.getStoragePath();
    if (!storagePath) {
      return null;
    }

    // Load file content from storage
    const content = await this.storageService.retrieve(storagePath);

    const attachmentDto = AttachmentAdapter.toDTO(attachment, this.baseUrl);

    return {
      attachment: attachmentDto,
      content
    };
  }
}
