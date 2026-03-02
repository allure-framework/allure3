import { describe, it, expect } from 'vitest';
import { HistoryAdapter } from '../../../../src/application/adapters/HistoryAdapter.js';
import { HistoryEntry } from '../../../../src/domain/entities/HistoryEntry.js';
import { HistoryId } from '../../../../src/domain/value-objects/HistoryId.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';

describe('HistoryAdapter', () => {
  it('should convert Domain to DTO', () => {
    const entry = new HistoryEntry(
      'entry-id',
      new HistoryId('history-id'),
      new TestResultId('test-result-id'),
      new LaunchId('launch-id'),
      new Status('passed'),
      1000,
      500
    );

    const dto = HistoryAdapter.toDTO(entry);
    expect(dto.id).toBe('entry-id');
    expect(dto.status).toBe('passed');
    expect(dto.start).toBe(1000);
    expect(dto.duration).toBe(500);
  });

  it('should create Domain from data', () => {
    const entry = HistoryAdapter.toDomain(
      'entry-id',
      new HistoryId('history-id'),
      new TestResultId('test-result-id'),
      new LaunchId('launch-id'),
      new Status('passed'),
      1000,
      500
    );

    expect(entry.getId()).toBe('entry-id');
    expect(entry.getStatus().getValue()).toBe('passed');
  });
});
