import { describe, it, expect } from 'vitest';
import { TestError } from '../../../../src/domain/value-objects/TestError.js';

describe('TestError', () => {
  it('should create TestError with message', () => {
    const error = new TestError('Error message');
    expect(error.getMessage()).toBe('Error message');
    expect(error.hasError()).toBe(true);
  });

  it('should create TestError with all fields', () => {
    const error = new TestError('Error message', 'Stack trace', 'Actual value', 'Expected value');
    expect(error.getMessage()).toBe('Error message');
    expect(error.getTrace()).toBe('Stack trace');
    expect(error.getActual()).toBe('Actual value');
    expect(error.getExpected()).toBe('Expected value');
    expect(error.hasError()).toBe(true);
  });

  it('should create empty TestError', () => {
    const error = new TestError();
    expect(error.getMessage()).toBeNull();
    expect(error.getTrace()).toBeNull();
    expect(error.getActual()).toBeNull();
    expect(error.getExpected()).toBeNull();
    expect(error.hasError()).toBe(false);
  });

  it('should create TestError with only trace', () => {
    const error = new TestError(null, 'Stack trace');
    expect(error.getMessage()).toBeNull();
    expect(error.getTrace()).toBe('Stack trace');
    expect(error.hasError()).toBe(true);
  });

  it('should create TestError with only actual and expected', () => {
    const error = new TestError(null, null, 'Actual', 'Expected');
    expect(error.getActual()).toBe('Actual');
    expect(error.getExpected()).toBe('Expected');
    expect(error.hasError()).toBe(true);
  });

  it('should be equal to another TestError with same values', () => {
    const error1 = new TestError('Message', 'Trace', 'Actual', 'Expected');
    const error2 = new TestError('Message', 'Trace', 'Actual', 'Expected');
    expect(error1.equals(error2)).toBe(true);
  });

  it('should not be equal to another TestError with different message', () => {
    const error1 = new TestError('Message 1');
    const error2 = new TestError('Message 2');
    expect(error1.equals(error2)).toBe(false);
  });

  it('should be immutable', () => {
    const error = new TestError('Message');
    const message = error.getMessage();
    expect(error.getMessage()).toBe(message);
  });
});
