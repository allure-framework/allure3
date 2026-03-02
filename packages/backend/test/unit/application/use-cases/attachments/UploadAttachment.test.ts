import { describe, it, expect, beforeEach } from 'vitest';
import { UploadAttachment } from '../../../../../src/application/use-cases/attachments/UploadAttachment.js';
import type { IAttachmentRepository } from '../../../../../src/domain/repositories/IAttachmentRepository.js';
import type { AttachmentStorageService } from '../../../../../src/application/use-cases/attachments/UploadAttachment.js';

describe('UploadAttachment', () => {
  let mockRepository: IAttachmentRepository;
  let mockStorageService: AttachmentStorageService;
  let useCase: UploadAttachment;

  beforeEach(() => {
    mockRepository = {
      save: async () => {},
      findById: async () => null,
      findByUid: async () => null,
      delete: async () => {},
      exists: async () => false
    };
    mockStorageService = {
      store: async () => '/storage/path/file.png',
      retrieve: async () => Buffer.from('test'),
      delete: async () => {}
    };
    useCase = new UploadAttachment(mockRepository, mockStorageService, 'https://api.example.com');
  });

  it('should upload attachment', async () => {
    const file = {
      originalname: 'screenshot.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('test')
    } as Express.Multer.File;

    const metadata = {
      name: 'Screenshot'
    };

    const response = await useCase.execute('launch-id', file, metadata);
    expect(response.uid).toBeDefined();
    expect(response.name).toBe('Screenshot');
    expect(response.contentType).toBe('image/png');
  });

  it('should use original filename if name not provided', async () => {
    const file = {
      originalname: 'screenshot.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('test')
    } as Express.Multer.File;

    const response = await useCase.execute('launch-id', file, {});
    expect(response.name).toBe('screenshot.png');
  });
});
