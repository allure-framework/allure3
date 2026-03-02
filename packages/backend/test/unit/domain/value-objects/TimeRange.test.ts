import { describe, it, expect } from 'vitest';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';

describe('TimeRange', () => {
  it('should create valid TimeRange with start and stop', () => {
    const range = new TimeRange(1000, 2000);
    expect(range.getStart()).toBe(1000);
    expect(range.getStop()).toBe(2000);
    expect(range.getDuration()).toBe(1000);
  });

  it('should create valid TimeRange with null start', () => {
    const range = new TimeRange(null, 2000);
    expect(range.getStart()).toBeNull();
    expect(range.getStop()).toBe(2000);
    expect(range.getDuration()).toBeNull();
  });

  it('should create valid TimeRange with null stop', () => {
    const range = new TimeRange(1000, null);
    expect(range.getStart()).toBe(1000);
    expect(range.getStop()).toBeNull();
    expect(range.getDuration()).toBeNull();
  });

  it('should create valid TimeRange with both null', () => {
    const range = new TimeRange(null, null);
    expect(range.getStart()).toBeNull();
    expect(range.getStop()).toBeNull();
    expect(range.getDuration()).toBeNull();
    expect(range.isValid()).toBe(true);
  });

  it('should throw error when start is greater than stop', () => {
    expect(() => new TimeRange(2000, 1000)).toThrow('Start time cannot be greater than stop time');
  });

  it('should throw error when start is negative', () => {
    expect(() => new TimeRange(-1, 1000)).toThrow('Start time cannot be negative');
  });

  it('should throw error when stop is negative', () => {
    expect(() => new TimeRange(1000, -1)).toThrow('Stop time cannot be negative');
  });

  it('should calculate duration correctly', () => {
    const range = new TimeRange(1000, 5000);
    expect(range.getDuration()).toBe(4000);
  });

  it('should return null duration when start is null', () => {
    const range = new TimeRange(null, 2000);
    expect(range.getDuration()).toBeNull();
  });

  it('should return null duration when stop is null', () => {
    const range = new TimeRange(1000, null);
    expect(range.getDuration()).toBeNull();
  });

  it('should validate correctly when start equals stop', () => {
    const range = new TimeRange(1000, 1000);
    expect(range.isValid()).toBe(true);
    expect(range.getDuration()).toBe(0);
  });

  it('should be equal to another TimeRange with same values', () => {
    const range1 = new TimeRange(1000, 2000);
    const range2 = new TimeRange(1000, 2000);
    expect(range1.equals(range2)).toBe(true);
  });

  it('should not be equal to another TimeRange with different values', () => {
    const range1 = new TimeRange(1000, 2000);
    const range2 = new TimeRange(1000, 3000);
    expect(range1.equals(range2)).toBe(false);
  });

  it('should be immutable', () => {
    const range = new TimeRange(1000, 2000);
    const start = range.getStart();
    const stop = range.getStop();
    expect(range.getStart()).toBe(start);
    expect(range.getStop()).toBe(stop);
  });
});
