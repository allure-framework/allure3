import { describe, it, expect } from 'vitest';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';

describe('TestName', () => {
  it('should create valid TestName', () => {
    const name = new TestName('Test Name');
    expect(name.getValue()).toBe('Test Name');
  });

  it('should create TestName with fullName', () => {
    const name = new TestName('Test Name', 'Full Test Name');
    expect(name.getValue()).toBe('Test Name');
    expect(name.getFullName()).toBe('Full Test Name');
  });

  it('should throw error for empty value', () => {
    expect(() => new TestName('')).toThrow('TestName cannot be empty');
  });

  it('should throw error for whitespace-only value', () => {
    expect(() => new TestName('   ')).toThrow('TestName cannot be empty');
  });

  it('should throw error for null value', () => {
    expect(() => new TestName(null as any)).toThrow('TestName cannot be empty');
  });

  it('should throw error for undefined value', () => {
    expect(() => new TestName(undefined as any)).toThrow('TestName cannot be empty');
  });

  it('should throw error for value exceeding max length', () => {
    const longName = 'a'.repeat(10001);
    expect(() => new TestName(longName)).toThrow('TestName exceeds maximum length');
  });

  it('should accept value at max length', () => {
    const longName = 'a'.repeat(10000);
    const name = new TestName(longName);
    expect(name.getValue()).toBe(longName);
  });

  it('should be equal to another TestName with same value and fullName', () => {
    const name1 = new TestName('Test Name', 'Full Name');
    const name2 = new TestName('Test Name', 'Full Name');
    expect(name1.equals(name2)).toBe(true);
  });

  it('should not be equal to another TestName with different value', () => {
    const name1 = new TestName('Test Name 1');
    const name2 = new TestName('Test Name 2');
    expect(name1.equals(name2)).toBe(false);
  });

  it('should not be equal to another TestName with different fullName', () => {
    const name1 = new TestName('Test Name', 'Full Name 1');
    const name2 = new TestName('Test Name', 'Full Name 2');
    expect(name1.equals(name2)).toBe(false);
  });

  it('should be immutable', () => {
    const name = new TestName('Test Name');
    const value = name.getValue();
    expect(name.getValue()).toBe(value);
  });
});
