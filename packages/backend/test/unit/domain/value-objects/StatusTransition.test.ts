import { describe, it, expect } from 'vitest';
import { StatusTransition } from '../../../../src/domain/value-objects/StatusTransition.js';

describe('StatusTransition', () => {
  it('should create valid transition: regressed', () => {
    const transition = new StatusTransition('regressed');
    expect(transition.getValue()).toBe('regressed');
  });

  it('should create valid transition: fixed', () => {
    const transition = new StatusTransition('fixed');
    expect(transition.getValue()).toBe('fixed');
  });

  it('should create valid transition: malfunctioned', () => {
    const transition = new StatusTransition('malfunctioned');
    expect(transition.getValue()).toBe('malfunctioned');
  });

  it('should create valid transition: new', () => {
    const transition = new StatusTransition('new');
    expect(transition.getValue()).toBe('new');
  });

  it('should throw error for invalid transition', () => {
    expect(() => new StatusTransition('invalid' as any)).toThrow('Invalid status transition: invalid');
  });

  it('should be equal to another StatusTransition with same value', () => {
    const transition1 = new StatusTransition('regressed');
    const transition2 = new StatusTransition('regressed');
    expect(transition1.equals(transition2)).toBe(true);
  });

  it('should not be equal to another StatusTransition with different value', () => {
    const transition1 = new StatusTransition('regressed');
    const transition2 = new StatusTransition('fixed');
    expect(transition1.equals(transition2)).toBe(false);
  });

  it('should be immutable', () => {
    const transition = new StatusTransition('regressed');
    const value = transition.getValue();
    expect(transition.getValue()).toBe(value);
  });
});
