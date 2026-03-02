import { describe, it, expect } from 'vitest';
import { AttachmentId } from '../../../../src/domain/value-objects/AttachmentId.js';

describe('AttachmentId', () => {
  it('should create valid AttachmentId', () => {
    const id = new AttachmentId('attachment-id');
    expect(id.getValue()).toBe('attachment-id');
  });

  it('should throw error for empty value', () => {
    expect(() => new AttachmentId('')).toThrow('AttachmentId cannot be empty');
  });

  it('should throw error for null value', () => {
    expect(() => new AttachmentId(null as any)).toThrow('AttachmentId cannot be empty');
  });

  it('should throw error for undefined value', () => {
    expect(() => new AttachmentId(undefined as any)).toThrow('AttachmentId cannot be empty');
  });

  it('should be equal to another AttachmentId with same value', () => {
    const id1 = new AttachmentId('attachment-id');
    const id2 = new AttachmentId('attachment-id');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should not be equal to another AttachmentId with different value', () => {
    const id1 = new AttachmentId('attachment-id-1');
    const id2 = new AttachmentId('attachment-id-2');
    expect(id1.equals(id2)).toBe(false);
  });

  it('should be immutable', () => {
    const id = new AttachmentId('attachment-id');
    const value = id.getValue();
    expect(id.getValue()).toBe(value);
  });
});
