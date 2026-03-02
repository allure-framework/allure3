import { describe, it, expect, beforeEach } from 'vitest';
import { GetAttachment } from '../../../../../src/application/use-cases/attachments/GetAttachment.js';
import type { IAttachmentRepository } from '../../../../../src/domain/repositories/IAttachmentRepository.js';
import type { AttachmentStorageService } from '../../../../../src/application/use-cases/attachments/GetAttachment.js';
import { Attachment } from '../../../../../src/domain/entities/Attachment.js';
import { AttachmentId } from '../../../../../src/domain/value-objects/AttachmentId.js';

describe('GetAttachment', () => {
  let mockRepository: IAttachmentRepository;
  let mockStorageService: AttachmentStorageService;
  let useCase: GetAttachment;

  beforeEach(() => {
    const attachment = new Attachment(
      new AttachmentId('attachment-id'),
      'uid-123',
      'screenshot.png',
      'image/png',
      1024,
      '/storage/path/file.png',
      'screenshot.png'
    );
    mockRepository = {
      save: async () => {},
      findById: async () => null,
      findByUid: async (uid) => (uid === 'uid-123' ? attachment : null),
      delete: async () => {},
      exists: async () => false
    };
    mockStorageService = {
      store: async () => '/storage/path',
      retrieve: async () => Buffer.from('test content'),
      delete: async () => {}
    };
    useCase = new GetAttachment(mockRepository, mockStorageService, 'https://api.example.com');
  });

  it('should get attachment by UID', async () => {
    const result = await useCase.execute('uid-123');
    expect(result).not.toBeNull();
    expect(result!.attachment.uid).toBe('uid-123');
    expect(result!.attachment.name).toBe('screenshot.png');
    expect(result!.content).toBeInstanceOf(Buffer);
  });

  it('should return null for non-existent attachment', async () => {
    const result = await useCase.execute('non-existent-uid');
    expect(result).toBeNull();
  });

  it('should return null if attachment has no storage path', async () => {
    const attachmentWithoutPath = new Attachment(
      new AttachmentId('attachment-id'),
      'uid-456',
      'screenshot.png',
      'image/png',
      1024,
      null,
      'screenshot.png'
    );
    mockRepository.findByUid = async () => attachmentWithoutPath;

    const result = await useCase.execute('uid-456');
    expect(result).toBeNull();
  });
});
