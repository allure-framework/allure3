import { describe, it, expect } from 'vitest';
import { Parameter } from '../../../../src/domain/value-objects/Parameter.js';

describe('Parameter', () => {
  it('should create Parameter with name and value', () => {
    const param = new Parameter('param1', 'value1');
    expect(param.getName()).toBe('param1');
    expect(param.getValue()).toBe('value1');
    expect(param.isHidden()).toBe(false);
    expect(param.isExcluded()).toBe(false);
    expect(param.isMasked()).toBe(false);
  });

  it('should create Parameter with all flags', () => {
    const param = new Parameter('param1', 'value1', true, true, true);
    expect(param.getName()).toBe('param1');
    expect(param.getValue()).toBe('value1');
    expect(param.isHidden()).toBe(true);
    expect(param.isExcluded()).toBe(true);
    expect(param.isMasked()).toBe(true);
  });

  it('should throw error for empty name', () => {
    expect(() => new Parameter('', 'value1')).toThrow('Parameter name cannot be empty');
  });

  it('should throw error for whitespace-only name', () => {
    expect(() => new Parameter('   ', 'value1')).toThrow('Parameter name cannot be empty');
  });

  it('should throw error for null name', () => {
    expect(() => new Parameter(null as any, 'value1')).toThrow('Parameter name cannot be empty');
  });

  it('should throw error for undefined name', () => {
    expect(() => new Parameter(undefined as any, 'value1')).toThrow('Parameter name cannot be empty');
  });

  it('should accept empty value string', () => {
    const param = new Parameter('param1', '');
    expect(param.getValue()).toBe('');
  });

  it('should be equal to another Parameter with same values', () => {
    const param1 = new Parameter('param1', 'value1', true, false, true);
    const param2 = new Parameter('param1', 'value1', true, false, true);
    expect(param1.equals(param2)).toBe(true);
  });

  it('should not be equal to another Parameter with different name', () => {
    const param1 = new Parameter('param1', 'value1');
    const param2 = new Parameter('param2', 'value1');
    expect(param1.equals(param2)).toBe(false);
  });

  it('should not be equal to another Parameter with different value', () => {
    const param1 = new Parameter('param1', 'value1');
    const param2 = new Parameter('param1', 'value2');
    expect(param1.equals(param2)).toBe(false);
  });

  it('should not be equal to another Parameter with different hidden flag', () => {
    const param1 = new Parameter('param1', 'value1', false);
    const param2 = new Parameter('param1', 'value1', true);
    expect(param1.equals(param2)).toBe(false);
  });

  it('should not be equal to another Parameter with different excluded flag', () => {
    const param1 = new Parameter('param1', 'value1', false, false);
    const param2 = new Parameter('param1', 'value1', false, true);
    expect(param1.equals(param2)).toBe(false);
  });

  it('should not be equal to another Parameter with different masked flag', () => {
    const param1 = new Parameter('param1', 'value1', false, false, false);
    const param2 = new Parameter('param1', 'value1', false, false, true);
    expect(param1.equals(param2)).toBe(false);
  });

  it('should be immutable', () => {
    const param = new Parameter('param1', 'value1');
    const name = param.getName();
    const value = param.getValue();
    expect(param.getName()).toBe(name);
    expect(param.getValue()).toBe(value);
  });
});
