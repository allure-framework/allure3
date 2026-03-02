import { LaunchId } from '../value-objects/LaunchId.js';
import { TestResultId } from '../value-objects/TestResultId.js';
import { ExecutorInfo } from '../value-objects/ExecutorInfo.js';
import { TestResult } from './TestResult.js';
import type { Statistic } from '../types/Statistic.js';

export class Launch {
  private readonly testResults: TestResult[] = [];

  constructor(
    private readonly id: LaunchId,
    private name: string,
    private startTime: Date,
    private stopTime: Date | null = null,
    private executor: ExecutorInfo | null = null,
    private environment: string | null = null,
    private reportUuid: string | null = null,
    private readonly parentLaunchId: LaunchId | null = null,
    private readonly runKey: string | null = null
  ) {}

  getId(): LaunchId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getStartTime(): Date {
    return this.startTime;
  }

  getStopTime(): Date | null {
    return this.stopTime;
  }

  getExecutor(): ExecutorInfo | null {
    return this.executor;
  }

  getEnvironment(): string | null {
    return this.environment;
  }

  getReportUuid(): string | null {
    return this.reportUuid;
  }

  getParentLaunchId(): LaunchId | null {
    return this.parentLaunchId;
  }

  getRunKey(): string | null {
    return this.runKey;
  }

  addTestResult(result: TestResult): void {
    if (this.isCompleted()) {
      throw new Error('Cannot add test result to completed launch');
    }
    this.testResults.push(result);
  }

  /** For persistence hydration only: add test results when restoring from DB (e.g. completed launch). */
  addTestResultFromPersistence(result: TestResult): void {
    this.testResults.push(result);
  }

  removeTestResult(resultId: TestResultId): void {
    const index = this.testResults.findIndex((r) => r.getId().equals(resultId));
    if (index !== -1) {
      this.testResults.splice(index, 1);
    }
  }

  getTestResults(): ReadonlyArray<TestResult> {
    return [...this.testResults];
  }

  complete(): void {
    if (this.stopTime !== null) {
      throw new Error('Launch is already completed');
    }
    this.stopTime = new Date();
  }

  isCompleted(): boolean {
    return this.stopTime !== null;
  }

  getDuration(): number | null {
    if (this.stopTime === null) {
      return null;
    }
    return this.stopTime.getTime() - this.startTime.getTime();
  }

  getStatistic(): Statistic {
    const statistic: Statistic = {
      total: this.testResults.length,
      failed: 0,
      broken: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
      retries: 0,
      flaky: 0
    };

    for (const result of this.testResults) {
      const status = result.getStatus().getValue();
      switch (status) {
        case 'failed':
          statistic.failed = (statistic.failed || 0) + 1;
          break;
        case 'broken':
          statistic.broken = (statistic.broken || 0) + 1;
          break;
        case 'passed':
          statistic.passed = (statistic.passed || 0) + 1;
          break;
        case 'skipped':
          statistic.skipped = (statistic.skipped || 0) + 1;
          break;
        case 'unknown':
          statistic.unknown = (statistic.unknown || 0) + 1;
          break;
      }

      if (result.isFlaky()) {
        statistic.flaky = (statistic.flaky || 0) + 1;
      }

      if (result.hasRetries()) {
        statistic.retries = (statistic.retries || 0) + result.getRetriesCount();
      }
    }

    return statistic;
  }
}
