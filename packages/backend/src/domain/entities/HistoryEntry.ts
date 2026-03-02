import { HistoryId } from '../value-objects/HistoryId.js';
import { TestResultId } from '../value-objects/TestResultId.js';
import { LaunchId } from '../value-objects/LaunchId.js';
import { Status } from '../value-objects/Status.js';

export class HistoryEntry {
  constructor(
    private readonly id: string,
    private readonly historyId: HistoryId,
    private readonly testResultId: TestResultId,
    private readonly launchId: LaunchId,
    private readonly status: Status,
    private readonly startTime: number | null = null,
    private readonly duration: number | null = null
  ) {
    if (!id || id.trim().length === 0) {
      throw new Error('HistoryEntry ID cannot be empty');
    }
    if (startTime !== null && startTime < 0) {
      throw new Error('Start time cannot be negative');
    }
    if (duration !== null && duration < 0) {
      throw new Error('Duration cannot be negative');
    }
  }

  getId(): string {
    return this.id;
  }

  getHistoryId(): HistoryId {
    return this.historyId;
  }

  getTestResultId(): TestResultId {
    return this.testResultId;
  }

  getLaunchId(): LaunchId {
    return this.launchId;
  }

  getStatus(): Status {
    return this.status;
  }

  getStartTime(): number | null {
    return this.startTime;
  }

  getDuration(): number | null {
    return this.duration;
  }
}
