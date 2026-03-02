import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteAttachment } from '../../../../../src/application/use-cases/attachments/DeleteAttachment.js';
import type { IAttachmentRepository } from '../../../../../src/domain/repositories/IAttachmentRepository.js';
import type { AttachmentStorageService } from '../../../../../src/application/use-cases/attachments/DeleteAttachment.js';
import { Attachment } from '../../../../../src/domain/entities/Attachment.js';
import { AttachmentId } from '../../../../../src/domain/value-objects/AttachmentId.js';

describe('DeleteAttachment', () => {
  let mockRepository: IAttachmentRepository;
  let mockStorageService: AttachmentStorageService;
  let useCase: DeleteAttachment;

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
      findById: async (id) => (id.getValue() === 'attachment-id' ? attachment : null),
      findByUid: async () => null,
      delete: async () => {},
      exists: async () => false
    };
    let deletedFromStorage = false;
    mockStorageService = {
      store: async () => '/storage/path',
      retrieve: async () => Buffer.from('test'),
      delete: async () => {
        deletedFromStorage = true;
      }
    };
    useCase = new DeleteAttachment(mockRepository, mockStorageService);
  });

  it('should delete attachment', async () => {
    await expect(useCase.execute('attachment-id')).resolves.not.toThrow();
  });

  it('should throw error if attachment not found', async () => {
    await expect(useCase.execute('non-existent-id')).rejects.toThrow('Attachment not found');
  });
});
