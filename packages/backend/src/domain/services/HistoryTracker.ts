import { TestResult } from '../entities/TestResult.js';
import { HistoryEntry } from '../entities/HistoryEntry.js';
import { LaunchId } from '../value-objects/LaunchId.js';
import { StatusTransition } from '../value-objects/StatusTransition.js';
import { StatusTransitionCalculator } from './StatusTransitionCalculator.js';
import { FlakyDetector } from './FlakyDetector.js';

export class HistoryTracker {
  private readonly transitionCalculator: StatusTransitionCalculator;
  private readonly flakyDetector: FlakyDetector;

  constructor() {
    this.transitionCalculator = new StatusTransitionCalculator();
    this.flakyDetector = new FlakyDetector();
  }

  trackTestResult(
    current: TestResult,
    previous: TestResult | null,
    launchId: LaunchId,
    entryId: string
  ): HistoryEntry {
    const historyId = current.getHistoryId();
    if (!historyId) {
      throw new Error('TestResult must have historyId to track');
    }

    const timeRange = current.getTimeRange();
    const startTime = timeRange.getStart();
    const duration = timeRange.getDuration();

    return new HistoryEntry(
      entryId,
      historyId,
      current.getId(),
      launchId,
      current.getStatus(),
      startTime,
      duration
    );
  }

  calculateTransition(current: TestResult, previous: TestResult | null): StatusTransition | null {
    const previousStatus = previous ? previous.getStatus() : null;
    return this.transitionCalculator.calculate(current.getStatus(), previousStatus);
  }

  isFlaky(current: TestResult, history: ReadonlyArray<HistoryEntry>): boolean {
    return this.flakyDetector.detect(history);
  }
}
