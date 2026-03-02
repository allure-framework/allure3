import { describe, it, expect } from 'vitest';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';

describe('TestResultId', () => {
  it('should create valid TestResultId with UUID', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const id = new TestResultId(uuid);
    expect(id.getValue()).toBe(uuid);
  });

  it('should create valid TestResultId with non-UUID string', () => {
    const id = new TestResultId('test-result-id');
    expect(id.getValue()).toBe('test-result-id');
  });

  it('should throw error for empty value', () => {
    expect(() => new TestResultId('')).toThrow('TestResultId cannot be empty');
  });

  it('should throw error for null value', () => {
    expect(() => new TestResultId(null as any)).toThrow('TestResultId cannot be empty');
  });

  it('should throw error for undefined value', () => {
    expect(() => new TestResultId(undefined as any)).toThrow('TestResultId cannot be empty');
  });

  it('should be equal to another TestResultId with same value', () => {
    const id1 = new TestResultId('test-id');
    const id2 = new TestResultId('test-id');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should not be equal to another TestResultId with different value', () => {
    const id1 = new TestResultId('test-id-1');
    const id2 = new TestResultId('test-id-2');
    expect(id1.equals(id2)).toBe(false);
  });

  it('should be immutable', () => {
    const id = new TestResultId('test-id');
    const value = id.getValue();
    expect(id.getValue()).toBe(value);
  });
});
