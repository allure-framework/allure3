import { describe, it, expect } from 'vitest';
import { Status } from '../../../../src/domain/value-objects/Status.js';

describe('Status', () => {
  it('should create valid status: passed', () => {
    const status = new Status('passed');
    expect(status.getValue()).toBe('passed');
  });

  it('should create valid status: failed', () => {
    const status = new Status('failed');
    expect(status.getValue()).toBe('failed');
  });

  it('should create valid status: broken', () => {
    const status = new Status('broken');
    expect(status.getValue()).toBe('broken');
  });

  it('should create valid status: skipped', () => {
    const status = new Status('skipped');
    expect(status.getValue()).toBe('skipped');
  });

  it('should create valid status: unknown', () => {
    const status = new Status('unknown');
    expect(status.getValue()).toBe('unknown');
  });

  it('should throw error for invalid status', () => {
    expect(() => new Status('invalid' as any)).toThrow('Invalid status: invalid');
  });

  it('should check if status is passed', () => {
    const status = new Status('passed');
    expect(status.isPassed()).toBe(true);
    expect(status.isFailed()).toBe(false);
  });

  it('should check if status is failed', () => {
    const status = new Status('failed');
    expect(status.isFailed()).toBe(true);
    expect(status.isPassed()).toBe(false);
  });

  it('should check if status is broken', () => {
    const status = new Status('broken');
    expect(status.isBroken()).toBe(true);
    expect(status.isFailed()).toBe(true);
    expect(status.isPassed()).toBe(false);
  });

  it('should check if status is skipped', () => {
    const status = new Status('skipped');
    expect(status.isSkipped()).toBe(true);
  });

  it('should check if status is unknown', () => {
    const status = new Status('unknown');
    expect(status.isUnknown()).toBe(true);
  });

  it('should compare statuses correctly - failed worse than passed', () => {
    const failed = new Status('failed');
    const passed = new Status('passed');
    expect(failed.isWorseThan(passed)).toBe(true);
  });

  it('should compare statuses correctly - broken worse than passed', () => {
    const broken = new Status('broken');
    const passed = new Status('passed');
    expect(broken.isWorseThan(passed)).toBe(true);
  });

  it('should compare statuses correctly - passed not worse than failed', () => {
    const passed = new Status('passed');
    const failed = new Status('failed');
    expect(passed.isWorseThan(failed)).toBe(false);
  });

  it('should get priority correctly', () => {
    expect(new Status('failed').getPriority()).toBe(0);
    expect(new Status('broken').getPriority()).toBe(1);
    expect(new Status('passed').getPriority()).toBe(2);
    expect(new Status('skipped').getPriority()).toBe(3);
    expect(new Status('unknown').getPriority()).toBe(4);
  });

  it('should be equal to another Status with same value', () => {
    const status1 = new Status('passed');
    const status2 = new Status('passed');
    expect(status1.equals(status2)).toBe(true);
  });

  it('should not be equal to another Status with different value', () => {
    const status1 = new Status('passed');
    const status2 = new Status('failed');
    expect(status1.equals(status2)).toBe(false);
  });

  it('should be immutable', () => {
    const status = new Status('passed');
    const value = status.getValue();
    expect(status.getValue()).toBe(value);
  });
});
