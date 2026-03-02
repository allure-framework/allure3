import { describe, it, expect } from 'vitest';
import { HistoryEntry } from '../../../../src/domain/entities/HistoryEntry.js';
import { HistoryId } from '../../../../src/domain/value-objects/HistoryId.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';

describe('HistoryEntry', () => {
  it('should create HistoryEntry with all fields', () => {
    const historyId = new HistoryId('history-id');
    const testResultId = new TestResultId('test-result-id');
    const launchId = new LaunchId('launch-id');
    const status = new Status('passed');
    const entry = new HistoryEntry(
      'entry-id',
      historyId,
      testResultId,
      launchId,
      status,
      1000,
      500
    );
    expect(entry.getId()).toBe('entry-id');
    expect(entry.getHistoryId().getValue()).toBe('history-id');
    expect(entry.getTestResultId().getValue()).toBe('test-result-id');
    expect(entry.getLaunchId().getValue()).toBe('launch-id');
    expect(entry.getStatus()).toBe(status);
    expect(entry.getStartTime()).toBe(1000);
    expect(entry.getDuration()).toBe(500);
  });

  it('should create HistoryEntry with null times', () => {
    const historyId = new HistoryId('history-id');
    const testResultId = new TestResultId('test-result-id');
    const launchId = new LaunchId('launch-id');
    const status = new Status('passed');
    const entry = new HistoryEntry(
      'entry-id',
      historyId,
      testResultId,
      launchId,
      status,
      null,
      null
    );
    expect(entry.getStartTime()).toBeNull();
    expect(entry.getDuration()).toBeNull();
  });

  it('should throw error for empty ID', () => {
    const historyId = new HistoryId('history-id');
    const testResultId = new TestResultId('test-result-id');
    const launchId = new LaunchId('launch-id');
    const status = new Status('passed');
    expect(() => new HistoryEntry('', historyId, testResultId, launchId, status))
      .toThrow('HistoryEntry ID cannot be empty');
  });

  it('should throw error for negative start time', () => {
    const historyId = new HistoryId('history-id');
    const testResultId = new TestResultId('test-result-id');
    const launchId = new LaunchId('launch-id');
    const status = new Status('passed');
    expect(() => new HistoryEntry('entry-id', historyId, testResultId, launchId, status, -1))
      .toThrow('Start time cannot be negative');
  });

  it('should throw error for negative duration', () => {
    const historyId = new HistoryId('history-id');
    const testResultId = new TestResultId('test-result-id');
    const launchId = new LaunchId('launch-id');
    const status = new Status('passed');
    expect(() => new HistoryEntry('entry-id', historyId, testResultId, launchId, status, 1000, -1))
      .toThrow('Duration cannot be negative');
  });
});
