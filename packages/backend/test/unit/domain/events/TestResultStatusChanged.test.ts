import { describe, it, expect } from 'vitest';
import { TestResultStatusChanged } from '../../../../src/domain/events/TestResultStatusChanged.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { StatusTransition } from '../../../../src/domain/value-objects/StatusTransition.js';

describe('TestResultStatusChanged', () => {
  it('should create event with status change information', () => {
    const testResultId = new TestResultId('test-result-id');
    const previousStatus = new Status('passed');
    const currentStatus = new Status('failed');
    const transition = new StatusTransition('regressed');
    const event = new TestResultStatusChanged(
      'aggregate-id',
      testResultId,
      previousStatus,
      currentStatus,
      transition
    );
    expect(event.getTestResultId()).toBe(testResultId);
    expect(event.getPreviousStatus()).toBe(previousStatus);
    expect(event.getCurrentStatus()).toBe(currentStatus);
    expect(event.getTransition()).toBe(transition);
  });

  it('should create event with null previous status for new test', () => {
    const testResultId = new TestResultId('test-result-id');
    const currentStatus = new Status('passed');
    const transition = new StatusTransition('new');
    const event = new TestResultStatusChanged(
      'aggregate-id',
      testResultId,
      null,
      currentStatus,
      transition
    );
    expect(event.getPreviousStatus()).toBeNull();
  });
});
