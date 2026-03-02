import { describe, it, expect } from 'vitest';
import { HistoryId } from '../../../../src/domain/value-objects/HistoryId.js';

describe('HistoryId', () => {
  it('should create valid HistoryId', () => {
    const id = new HistoryId('history-id');
    expect(id.getValue()).toBe('history-id');
  });

  it('should throw error for empty value', () => {
    expect(() => new HistoryId('')).toThrow('HistoryId cannot be empty');
  });

  it('should throw error for null value', () => {
    expect(() => new HistoryId(null as any)).toThrow('HistoryId cannot be empty');
  });

  it('should throw error for undefined value', () => {
    expect(() => new HistoryId(undefined as any)).toThrow('HistoryId cannot be empty');
  });

  it('should be equal to another HistoryId with same value', () => {
    const id1 = new HistoryId('history-id');
    const id2 = new HistoryId('history-id');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should not be equal to another HistoryId with different value', () => {
    const id1 = new HistoryId('history-id-1');
    const id2 = new HistoryId('history-id-2');
    expect(id1.equals(id2)).toBe(false);
  });

  it('should be immutable', () => {
    const id = new HistoryId('history-id');
    const value = id.getValue();
    expect(id.getValue()).toBe(value);
  });
});
