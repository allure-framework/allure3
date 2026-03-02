import { describe, it, expect } from 'vitest';
import { StatusTransitionCalculator } from '../../../../src/domain/services/StatusTransitionCalculator.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';

describe('StatusTransitionCalculator', () => {
  const calculator = new StatusTransitionCalculator();

  it('should calculate new transition when previous is null', () => {
    const current = new Status('passed');
    const transition = calculator.calculate(current, null);
    expect(transition).not.toBeNull();
    expect(transition!.getValue()).toBe('new');
  });

  it('should calculate regressed transition', () => {
    const current = new Status('failed');
    const previous = new Status('passed');
    const transition = calculator.calculate(current, previous);
    expect(transition).not.toBeNull();
    expect(transition!.getValue()).toBe('regressed');
  });

  it('should calculate fixed transition', () => {
    const current = new Status('passed');
    const previous = new Status('failed');
    const transition = calculator.calculate(current, previous);
    expect(transition).not.toBeNull();
    expect(transition!.getValue()).toBe('fixed');
  });

  it('should calculate malfunctioned transition', () => {
    const current = new Status('broken');
    const previous = new Status('passed');
    const transition = calculator.calculate(current, previous);
    expect(transition).not.toBeNull();
    expect(transition!.getValue()).toBe('malfunctioned');
  });

  it('should return null when no transition', () => {
    const current = new Status('passed');
    const previous = new Status('passed');
    const transition = calculator.calculate(current, previous);
    expect(transition).toBeNull();
  });

  it('should check if regressed', () => {
    const current = new Status('failed');
    const previous = new Status('passed');
    expect(calculator.isRegressed(current, previous)).toBe(true);
  });

  it('should check if fixed', () => {
    const current = new Status('passed');
    const previous = new Status('failed');
    expect(calculator.isFixed(current, previous)).toBe(true);
  });

  it('should check if malfunctioned', () => {
    const current = new Status('broken');
    const previous = new Status('passed');
    expect(calculator.isMalfunctioned(current, previous)).toBe(true);
  });

  it('should check if new', () => {
    expect(calculator.isNew(null)).toBe(true);
    expect(calculator.isNew(new Status('passed'))).toBe(false);
  });
});
