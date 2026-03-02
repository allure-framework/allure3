import { IAttachmentRepository } from '../../../domain/repositories/IAttachmentRepository.js';
import { AttachmentId } from '../../../domain/value-objects/AttachmentId.js';
import { AttachmentAdapter } from '../../adapters/AttachmentAdapter.js';
import { AttachmentResponse } from '../../dto/responses/AttachmentResponse.js';
import { UploadAttachmentMetadata } from '../../dto/requests/UploadAttachmentRequest.js';
import { randomUUID } from 'crypto';

export interface AttachmentStorageService {
  store(file: Express.Multer.File, uid: string): Promise<string>; // Returns storage path
  retrieve(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

export class UploadAttachment {
  constructor(
    private readonly attachmentRepository: IAttachmentRepository,
    private readonly storageService: AttachmentStorageService,
    private readonly baseUrl: string = ''
  ) {}

  async execute(
    launchId: string,
    file: Express.Multer.File,
    metadata: UploadAttachmentMetadata
  ): Promise<AttachmentResponse> {
    // Generate unique UID
    const uid = randomUUID();
    const id = new AttachmentId(randomUUID());

    // Store file
    const storagePath = await this.storageService.store(file, uid);

    // Create Attachment domain entity
    const attachment = AttachmentAdapter.toDomain(
      id,
      uid,
      metadata.name || file.originalname || null,
      file.mimetype || null,
      file.size || null,
      storagePath,
      file.originalname || null
    );

    // Save to repository with metadata (launchId for global attachments when testResultId is null)
    const saveMetadata = {
      testResultId: metadata.testResultId ?? undefined,
      stepId: metadata.stepId ?? undefined,
      launchId: !metadata.testResultId && !metadata.stepId ? launchId : undefined
    };
    await this.attachmentRepository.save(attachment, saveMetadata);

    return AttachmentAdapter.toDTO(attachment, this.baseUrl);
  }
}
