import { describe, it, expect } from 'vitest';
import { Attachment } from '../../../../src/domain/entities/Attachment.js';
import { AttachmentId } from '../../../../src/domain/value-objects/AttachmentId.js';

describe('Attachment', () => {
  it('should create Attachment with all fields', () => {
    const id = new AttachmentId('attachment-id');
    const attachment = new Attachment(
      id,
      'uid-123',
      'screenshot.png',
      'image/png',
      1024,
      '/storage/attachments/uid-123',
      'screenshot.png'
    );
    expect(attachment.getId().getValue()).toBe('attachment-id');
    expect(attachment.getUid()).toBe('uid-123');
    expect(attachment.getName()).toBe('screenshot.png');
    expect(attachment.getContentType()).toBe('image/png');
    expect(attachment.getContentLength()).toBe(1024);
    expect(attachment.getStoragePath()).toBe('/storage/attachments/uid-123');
    expect(attachment.getOriginalFileName()).toBe('screenshot.png');
  });

  it('should create Attachment with minimal fields', () => {
    const id = new AttachmentId('attachment-id');
    const attachment = new Attachment(id, 'uid-123');
    expect(attachment.getUid()).toBe('uid-123');
    expect(attachment.getName()).toBeNull();
    expect(attachment.getContentType()).toBeNull();
  });

  it('should throw error for empty UID', () => {
    const id = new AttachmentId('attachment-id');
    expect(() => new Attachment(id, '')).toThrow('Attachment UID cannot be empty');
  });

  it('should check if attachment has content', () => {
    const id = new AttachmentId('attachment-id');
    const attachmentWithContent = new Attachment(
      id,
      'uid-123',
      null,
      null,
      1024,
      '/storage/path'
    );
    expect(attachmentWithContent.hasContent()).toBe(true);
  });

  it('should return false for hasContent when no storage path', () => {
    const id = new AttachmentId('attachment-id');
    const attachment = new Attachment(id, 'uid-123', null, null, null, null);
    expect(attachment.hasContent()).toBe(false);
  });

  it('should return false for hasContent when contentLength is 0', () => {
    const id = new AttachmentId('attachment-id');
    const attachment = new Attachment(id, 'uid-123', null, null, 0, '/storage/path');
    expect(attachment.hasContent()).toBe(false);
  });
});
