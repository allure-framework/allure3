import { describe, it, expect } from 'vitest';
import { FlakyDetector } from '../../../../src/domain/services/FlakyDetector.js';
import { HistoryEntry } from '../../../../src/domain/entities/HistoryEntry.js';
import { HistoryId } from '../../../../src/domain/value-objects/HistoryId.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';

describe('FlakyDetector', () => {
  const detector = new FlakyDetector();

  function createHistoryEntry(status: Status, index: number): HistoryEntry {
    return new HistoryEntry(
      `entry-${index}`,
      new HistoryId('history-id'),
      new TestResultId(`test-result-${index}`),
      new LaunchId('launch-id'),
      status,
      1000 + index * 1000,
      500
    );
  }

  it('should return false for empty history', () => {
    expect(detector.detect([])).toBe(false);
  });

  it('should return false for single entry', () => {
    const entry = createHistoryEntry(new Status('passed'), 0);
    expect(detector.detect([entry])).toBe(false);
  });

  it('should detect flaky test with passed and failed', () => {
    const entry1 = createHistoryEntry(new Status('passed'), 0);
    const entry2 = createHistoryEntry(new Status('failed'), 1);
    expect(detector.detect([entry1, entry2])).toBe(true);
  });

  it('should detect flaky test with multiple status changes', () => {
    const entries = [
      createHistoryEntry(new Status('passed'), 0),
      createHistoryEntry(new Status('failed'), 1),
      createHistoryEntry(new Status('passed'), 2),
      createHistoryEntry(new Status('failed'), 3)
    ];
    expect(detector.detect(entries)).toBe(true);
  });

  it('should return false for stable test', () => {
    const entries = [
      createHistoryEntry(new Status('passed'), 0),
      createHistoryEntry(new Status('passed'), 1),
      createHistoryEntry(new Status('passed'), 2)
    ];
    expect(detector.detect(entries)).toBe(false);
  });

  it('should calculate flakiness rate correctly', () => {
    const entries = [
      createHistoryEntry(new Status('passed'), 0),
      createHistoryEntry(new Status('failed'), 1),
      createHistoryEntry(new Status('passed'), 2)
    ];
    const rate = detector.calculateFlakinessRate(entries);
    expect(rate).toBe(1.0); // 2 changes out of 2 transitions
  });

  it('should return 0 for empty history', () => {
    expect(detector.calculateFlakinessRate([])).toBe(0);
  });

  it('should return 0 for single entry', () => {
    const entry = createHistoryEntry(new Status('passed'), 0);
    expect(detector.calculateFlakinessRate([entry])).toBe(0);
  });
});
