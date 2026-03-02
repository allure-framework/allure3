import { describe, it, expect } from 'vitest';
import { TestResultUploaded } from '../../../../src/domain/events/TestResultUploaded.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';

describe('TestResultUploaded', () => {
  it('should create event with test result and launch IDs', () => {
    const testResultId = new TestResultId('test-result-id');
    const launchId = new LaunchId('launch-id');
    const event = new TestResultUploaded('aggregate-id', testResultId, launchId);
    expect(event.getTestResultId()).toBe(testResultId);
    expect(event.getLaunchId()).toBe(launchId);
    expect(event.getAggregateId()).toBe('aggregate-id');
  });
});
