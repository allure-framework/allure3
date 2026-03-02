import { HistoryEntry } from '../../domain/entities/HistoryEntry.js';
import { HistoryId } from '../../domain/value-objects/HistoryId.js';
import { HistoryTracker } from '../../domain/services/HistoryTracker.js';
import { FlakyDetector } from '../../domain/services/FlakyDetector.js';
import type { IHistoryRepository } from '../../domain/repositories/IHistoryRepository.js';
import type { HistoryTestResult } from '@allurereport/core-api';
import { HistoryAdapter } from '../adapters/HistoryAdapter.js';

export interface StatusTrend {
  date: number;
  status: string;
  count: number;
}

export class HistoryService {
  private readonly historyTracker: HistoryTracker;
  private readonly flakyDetector: FlakyDetector;

  constructor(private readonly historyRepository: IHistoryRepository) {
    this.historyTracker = new HistoryTracker();
    this.flakyDetector = new FlakyDetector();
  }

  async getTestHistory(historyId: HistoryId): Promise<HistoryTestResult[]> {
    const entries = await this.historyRepository.findByHistoryId(historyId);
    return entries
      .map((entry) => HistoryAdapter.toDTO(entry))
      .sort((a, b) => (b.start || 0) - (a.start || 0)); // Sort by start time descending
  }

  async calculateFlakiness(historyId: HistoryId): Promise<number> {
    const entries = await this.historyRepository.findByHistoryId(historyId);
    return this.flakyDetector.calculateFlakinessRate(entries);
  }

  async getStatusTrends(historyId: HistoryId): Promise<StatusTrend[]> {
    const entries = await this.historyRepository.findByHistoryId(historyId);
    const trends = new Map<number, Map<string, number>>();

    for (const entry of entries) {
      const startTime = entry.getStartTime();
      if (startTime === null) continue;

      const date = Math.floor(startTime / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24); // Round to day
      const status = entry.getStatus().getValue();

      if (!trends.has(date)) {
        trends.set(date, new Map());
      }

      const dayTrends = trends.get(date)!;
      dayTrends.set(status, (dayTrends.get(status) || 0) + 1);
    }

    const result: StatusTrend[] = [];
    for (const [date, statusCounts] of trends.entries()) {
      for (const [status, count] of statusCounts.entries()) {
        result.push({ date, status, count });
      }
    }

    return result.sort((a, b) => a.date - b.date);
  }
}
