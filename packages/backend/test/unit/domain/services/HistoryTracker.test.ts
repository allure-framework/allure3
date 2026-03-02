import { describe, it, expect } from 'vitest';
import { HistoryTracker } from '../../../../src/domain/services/HistoryTracker.js';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { HistoryId } from '../../../../src/domain/value-objects/HistoryId.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { HistoryEntry } from '../../../../src/domain/entities/HistoryEntry.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('HistoryTracker', () => {
  const tracker = new HistoryTracker();
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  function createTestResult(status: string = 'passed', historyId: HistoryId | null = null): TestResult {
    return new TestResult(
      new TestResultId('test-result-id'),
      new TestName('Test Name'),
      new Status(status as any),
      new TimeRange(1000, 2000),
      null,
      historyId,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      false,
      false,
      null,
      null,
      null,
      [],
      [],
      [],
      [],
      [],
      sourceMetadata,
      null
    );
  }

  it('should track test result', () => {
    const historyId = new HistoryId('history-id');
    const current = createTestResult('passed', historyId);
    const launchId = new LaunchId('launch-id');
    const entry = tracker.trackTestResult(current, null, launchId, 'entry-id');
    expect(entry).toBeInstanceOf(HistoryEntry);
    expect(entry.getHistoryId().getValue()).toBe('history-id');
  });

  it('should throw error when tracking result without historyId', () => {
    const current = createTestResult('passed', null);
    const launchId = new LaunchId('launch-id');
    expect(() => tracker.trackTestResult(current, null, launchId, 'entry-id'))
      .toThrow('TestResult must have historyId to track');
  });

  it('should calculate transition', () => {
    const previous = createTestResult('passed');
    const current = createTestResult('failed');
    const transition = tracker.calculateTransition(current, previous);
    expect(transition).not.toBeNull();
    expect(transition!.getValue()).toBe('regressed');
  });

  it('should return null transition when no change', () => {
    const previous = createTestResult('passed');
    const current = createTestResult('passed');
    const transition = tracker.calculateTransition(current, previous);
    expect(transition).toBeNull();
  });

  it('should check if test is flaky', () => {
    const historyId = new HistoryId('history-id');
    const current = createTestResult('passed', historyId);
    const launchId = new LaunchId('launch-id');
    const entry1 = new HistoryEntry('entry-1', historyId, current.getId(), launchId, new Status('passed'), 1000, 500);
    const entry2 = new HistoryEntry('entry-2', historyId, current.getId(), launchId, new Status('failed'), 2000, 500);
    const isFlaky = tracker.isFlaky(current, [entry1, entry2]);
    expect(isFlaky).toBe(true);
  });
});
