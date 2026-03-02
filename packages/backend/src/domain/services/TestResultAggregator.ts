import { TestResult } from '../entities/TestResult.js';
import { Status } from '../value-objects/Status.js';
import type { Statistic } from '../types/Statistic.js';
import type { Summary } from '../types/Summary.js';

export class TestResultAggregator {
  generateSummary(results: ReadonlyArray<TestResult>): Summary {
    const statistic = this.calculateStatistic(results);
    const duration = this.calculateTotalDuration(results);
    const flakyCount = results.filter((r) => r.isFlaky()).length;
    const retriesCount = results.reduce((sum, r) => sum + r.getRetriesCount(), 0);

    return {
      statistic,
      duration,
      flakyCount,
      retriesCount
    };
  }

  calculateStatistic(results: ReadonlyArray<TestResult>): Statistic {
    const statistic: Statistic = {
      total: results.length,
      failed: 0,
      broken: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
      retries: 0,
      flaky: 0
    };

    for (const result of results) {
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

  calculateTotalDuration(results: ReadonlyArray<TestResult>): number {
    return results.reduce((sum, result) => {
      const duration = result.getTimeRange().getDuration();
      return sum + (duration || 0);
    }, 0);
  }

  groupByStatus(results: ReadonlyArray<TestResult>): Map<Status, TestResult[]> {
    const map = new Map<string, TestResult[]>();
    const statusMap = new Map<string, Status>();
    
    for (const result of results) {
      const status = result.getStatus();
      const statusValue = status.getValue();
      
      if (!map.has(statusValue)) {
        map.set(statusValue, []);
        statusMap.set(statusValue, status);
      }
      const existing = map.get(statusValue)!;
      existing.push(result);
    }
    
    // Convert to Map<Status, TestResult[]>
    const resultMap = new Map<Status, TestResult[]>();
    for (const [statusValue, testResults] of map.entries()) {
      resultMap.set(statusMap.get(statusValue)!, testResults);
    }
    
    return resultMap;
  }

  groupByLabel(results: ReadonlyArray<TestResult>, labelName: string): Map<string, TestResult[]> {
    const map = new Map<string, TestResult[]>();
    for (const result of results) {
      const labels = result.findLabelsByName(labelName);
      if (labels.length === 0) {
        const key = '__no_label__';
        const existing = map.get(key) || [];
        existing.push(result);
        map.set(key, existing);
      } else {
        for (const label of labels) {
          const value = label.getValue() || '__no_value__';
          const existing = map.get(value) || [];
          existing.push(result);
          map.set(value, existing);
        }
      }
    }
    return map;
  }
}
