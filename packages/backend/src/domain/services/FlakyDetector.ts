import { HistoryEntry } from '../entities/HistoryEntry.js';

export class FlakyDetector {
  detect(history: ReadonlyArray<HistoryEntry>): boolean {
    if (history.length < 2) {
      return false;
    }

    const statuses = history.map((entry) => entry.getStatus());
    const hasPassed = statuses.some((status) => status.isPassed());
    const hasFailed = statuses.some((status) => status.isFailed());

    // Test is flaky if it has both passed and failed statuses
    if (hasPassed && hasFailed) {
      return true;
    }

    // Check for unstable status changes
    let statusChanges = 0;
    for (let i = 1; i < statuses.length; i++) {
      if (!statuses[i].equals(statuses[i - 1])) {
        statusChanges++;
      }
    }

    // If status changes more than 30% of the time, consider it flaky
    const changeRate = statusChanges / (history.length - 1);
    return changeRate > 0.3;
  }

  calculateFlakinessRate(history: ReadonlyArray<HistoryEntry>): number {
    if (history.length < 2) {
      return 0;
    }

    let statusChanges = 0;
    for (let i = 1; i < history.length; i++) {
      const current = history[i].getStatus();
      const previous = history[i - 1].getStatus();
      if (!current.equals(previous)) {
        statusChanges++;
      }
    }

    return statusChanges / (history.length - 1);
  }
}
