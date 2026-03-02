import { describe, it, expect } from 'vitest';
import { Label } from '../../../../src/domain/value-objects/Label.js';

describe('Label', () => {
  it('should create Label with name only', () => {
    const label = new Label('suite');
    expect(label.getName()).toBe('suite');
    expect(label.getValue()).toBeNull();
  });

  it('should create Label with name and value', () => {
    const label = new Label('suite', 'MySuite');
    expect(label.getName()).toBe('suite');
    expect(label.getValue()).toBe('MySuite');
  });

  it('should throw error for empty name', () => {
    expect(() => new Label('')).toThrow('Label name cannot be empty');
  });

  it('should throw error for whitespace-only name', () => {
    expect(() => new Label('   ')).toThrow('Label name cannot be empty');
  });

  it('should throw error for null name', () => {
    expect(() => new Label(null as any)).toThrow('Label name cannot be empty');
  });

  it('should throw error for undefined name', () => {
    expect(() => new Label(undefined as any)).toThrow('Label name cannot be empty');
  });

  it('should accept null value', () => {
    const label = new Label('suite', null);
    expect(label.getName()).toBe('suite');
    expect(label.getValue()).toBeNull();
  });

  it('should be equal to another Label with same name and value', () => {
    const label1 = new Label('suite', 'MySuite');
    const label2 = new Label('suite', 'MySuite');
    expect(label1.equals(label2)).toBe(true);
  });

  it('should not be equal to another Label with different name', () => {
    const label1 = new Label('suite', 'MySuite');
    const label2 = new Label('package', 'MySuite');
    expect(label1.equals(label2)).toBe(false);
  });

  it('should not be equal to another Label with different value', () => {
    const label1 = new Label('suite', 'MySuite');
    const label2 = new Label('suite', 'OtherSuite');
    expect(label1.equals(label2)).toBe(false);
  });

  it('should be equal when both have null value', () => {
    const label1 = new Label('suite', null);
    const label2 = new Label('suite', null);
    expect(label1.equals(label2)).toBe(true);
  });

  it('should not be equal when one has value and other has null', () => {
    const label1 = new Label('suite', 'MySuite');
    const label2 = new Label('suite', null);
    expect(label1.equals(label2)).toBe(false);
  });

  it('should be immutable', () => {
    const label = new Label('suite', 'MySuite');
    const name = label.getName();
    const value = label.getValue();
    expect(label.getName()).toBe(name);
    expect(label.getValue()).toBe(value);
  });
});
