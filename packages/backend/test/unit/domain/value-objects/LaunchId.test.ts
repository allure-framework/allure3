import { describe, it, expect } from 'vitest';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';

describe('LaunchId', () => {
  it('should create valid LaunchId', () => {
    const id = new LaunchId('test-id');
    expect(id.getValue()).toBe('test-id');
  });

  it('should throw error for empty value', () => {
    expect(() => new LaunchId('')).toThrow('LaunchId cannot be empty');
  });

  it('should throw error for null value', () => {
    expect(() => new LaunchId(null as any)).toThrow('LaunchId cannot be empty');
  });

  it('should throw error for undefined value', () => {
    expect(() => new LaunchId(undefined as any)).toThrow('LaunchId cannot be empty');
  });

  it('should be equal to another LaunchId with same value', () => {
    const id1 = new LaunchId('test-id');
    const id2 = new LaunchId('test-id');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should not be equal to another LaunchId with different value', () => {
    const id1 = new LaunchId('test-id-1');
    const id2 = new LaunchId('test-id-2');
    expect(id1.equals(id2)).toBe(false);
  });

  it('should be immutable', () => {
    const id = new LaunchId('test-id');
    const value = id.getValue();
    // Value should not change
    expect(id.getValue()).toBe(value);
  });
});
