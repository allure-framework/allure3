import type { HistoryTestResult } from '@allurereport/core-api';
import { HistoryEntry } from '../../domain/entities/HistoryEntry.js';
import { HistoryId } from '../../domain/value-objects/HistoryId.js';
import { TestResultId } from '../../domain/value-objects/TestResultId.js';
import { LaunchId } from '../../domain/value-objects/LaunchId.js';
import { Status } from '../../domain/value-objects/Status.js';

export class HistoryAdapter {
  static toDTO(domain: HistoryEntry): HistoryTestResult {
    return {
      id: domain.getId(),
      name: '', // Will be populated from test result
      fullName: undefined,
      environment: undefined,
      status: domain.getStatus().getValue(),
      error: undefined,
      start: domain.getStartTime() || undefined,
      stop: undefined,
      duration: domain.getDuration() || undefined,
      labels: undefined,
      url: '', // Will be populated based on launch/test result
      historyId: domain.getHistoryId().getValue() || undefined
    };
  }

  static toDomain(
    id: string,
    historyId: HistoryId,
    testResultId: TestResultId,
    launchId: LaunchId,
    status: Status,
    startTime: number | null,
    duration: number | null
  ): HistoryEntry {
    return new HistoryEntry(id, historyId, testResultId, launchId, status, startTime, duration);
  }
}
