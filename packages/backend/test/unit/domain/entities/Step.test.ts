import { describe, it, expect } from 'vitest';
import { Step } from '../../../../src/domain/entities/Step.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { TestError } from '../../../../src/domain/value-objects/TestError.js';
import { Parameter } from '../../../../src/domain/value-objects/Parameter.js';

describe('Step', () => {
  it('should create Step with all fields', () => {
    const status = new Status('passed');
    const timeRange = new TimeRange(1000, 2000);
    const error = new TestError('Error message');
    const parameter = new Parameter('param1', 'value1');
    const step = new Step(
      'step-id',
      'Step Name',
      status,
      timeRange,
      error,
      [parameter],
      [],
      'step-123',
      'Message',
      'Trace',
      false
    );
    expect(step.getId()).toBe('step-id');
    expect(step.getName()).toBe('Step Name');
    expect(step.getStatus()).toBe(status);
    expect(step.getTimeRange()).toBe(timeRange);
    expect(step.getError()).toBe(error);
    expect(step.getParameters().length).toBe(1);
    expect(step.getStepId()).toBe('step-123');
    expect(step.getMessage()).toBe('Message');
    expect(step.getTrace()).toBe('Trace');
  });

  it('should throw error for empty ID', () => {
    const status = new Status('passed');
    expect(() => new Step('', 'Step Name', status)).toThrow('Step ID cannot be empty');
  });

  it('should throw error for empty name', () => {
    const status = new Status('passed');
    expect(() => new Step('step-id', '', status)).toThrow('Step name cannot be empty');
  });

  it('should check if step has sub steps', () => {
    const status = new Status('passed');
    const subStep = new Step('sub-step-id', 'Sub Step', status);
    const step = new Step('step-id', 'Step Name', status, null, null, [], [subStep]);
    expect(step.hasSubSteps()).toBe(true);
  });

  it('should return false for hasSubSteps when no sub steps', () => {
    const status = new Status('passed');
    const step = new Step('step-id', 'Step Name', status);
    expect(step.hasSubSteps()).toBe(false);
  });

  it('should calculate depth correctly', () => {
    const status = new Status('passed');
    const subStep = new Step('sub-step-id', 'Sub Step', status);
    const step = new Step('step-id', 'Step Name', status, null, null, [], [subStep]);
    expect(step.getDepth()).toBe(1);
  });

  it('should return depth 0 for step without sub steps', () => {
    const status = new Status('passed');
    const step = new Step('step-id', 'Step Name', status);
    expect(step.getDepth()).toBe(0);
  });

  it('should calculate depth for nested steps', () => {
    const status = new Status('passed');
    const deepStep = new Step('deep-step-id', 'Deep Step', status);
    const subStep = new Step('sub-step-id', 'Sub Step', status, null, null, [], [deepStep]);
    const step = new Step('step-id', 'Step Name', status, null, null, [], [subStep]);
    expect(step.getDepth()).toBe(2);
  });
});
