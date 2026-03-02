import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryService } from '../../../../src/application/services/HistoryService.js';
import type { IHistoryRepository } from '../../../../src/domain/repositories/IHistoryRepository.js';
import { HistoryEntry } from '../../../../src/domain/entities/HistoryEntry.js';
import { HistoryId } from '../../../../src/domain/value-objects/HistoryId.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';

describe('HistoryService', () => {
  let mockRepository: IHistoryRepository;
  let service: HistoryService;

  beforeEach(() => {
    mockRepository = {
      save: async () => {},
      findByHistoryId: async (historyId: HistoryId) => {
        if (historyId.getValue() === 'history-id') {
          return [
            new HistoryEntry('entry-1', historyId, new TestResultId('test-1'), new LaunchId('launch-1'), new Status('passed'), 1000, 500),
            new HistoryEntry('entry-2', historyId, new TestResultId('test-2'), new LaunchId('launch-2'), new Status('failed'), 2000, 500)
          ];
        }
        return [];
      },
      findByTestResultId: async () => [],
      findLatestByHistoryId: async () => null,
      delete: async () => {}
    };
    service = new HistoryService(mockRepository);
  });

  it('should get test history', async () => {
    const historyId = new HistoryId('history-id');
    const history = await service.getTestHistory(historyId);
    expect(history.length).toBe(2);
    expect(history[0].start).toBe(2000); // Sorted descending
  });

  it('should calculate flakiness', async () => {
    const historyId = new HistoryId('history-id');
    const flakiness = await service.calculateFlakiness(historyId);
    expect(flakiness).toBeGreaterThanOrEqual(0);
    expect(flakiness).toBeLessThanOrEqual(1);
  });

  it('should get status trends', async () => {
    const historyId = new HistoryId('history-id');
    const trends = await service.getStatusTrends(historyId);
    expect(trends.length).toBeGreaterThan(0);
    expect(trends[0]).toHaveProperty('date');
    expect(trends[0]).toHaveProperty('status');
    expect(trends[0]).toHaveProperty('count');
  });
});
