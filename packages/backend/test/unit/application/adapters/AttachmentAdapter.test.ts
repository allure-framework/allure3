import { describe, it, expect } from 'vitest';
import { AttachmentAdapter } from '../../../../src/application/adapters/AttachmentAdapter.js';
import { Attachment } from '../../../../src/domain/entities/Attachment.js';
import { AttachmentId } from '../../../../src/domain/value-objects/AttachmentId.js';

describe('AttachmentAdapter', () => {
  it('should convert Domain to DTO', () => {
    const attachment = new Attachment(
      new AttachmentId('attachment-id'),
      'uid-123',
      'screenshot.png',
      'image/png',
      1024,
      '/storage/path',
      'screenshot.png'
    );

    const dto = AttachmentAdapter.toDTO(attachment, 'https://api.example.com');
    expect(dto.id).toBe('attachment-id');
    expect(dto.uid).toBe('uid-123');
    expect(dto.name).toBe('screenshot.png');
    expect(dto.url).toBe('https://api.example.com/api/v1/attachments/uid-123');
  });

  it('should create Domain from data', () => {
    const attachment = AttachmentAdapter.toDomain(
      new AttachmentId('attachment-id'),
      'uid-123',
      'screenshot.png',
      'image/png',
      1024,
      '/storage/path',
      'screenshot.png'
    );

    expect(attachment.getId().getValue()).toBe('attachment-id');
    expect(attachment.getUid()).toBe('uid-123');
  });
});
