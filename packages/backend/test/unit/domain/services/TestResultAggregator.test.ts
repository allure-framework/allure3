import { describe, it, expect } from 'vitest';
import { TestResultAggregator } from '../../../../src/domain/services/TestResultAggregator.js';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { Label } from '../../../../src/domain/value-objects/Label.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('TestResultAggregator', () => {
  const aggregator = new TestResultAggregator();
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  function createTestResult(status: string = 'passed', labels: Label[] = []): TestResult {
    return new TestResult(
      new TestResultId('test-result-id'),
      new TestName('Test Name'),
      new Status(status as any),
      new TimeRange(1000, 2000),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      false,
      false,
      false,
      null,
      null,
      null,
      labels,
      [],
      [],
      [],
      [],
      sourceMetadata,
      null
    );
  }

  it('should generate summary', () => {
    const results = [
      createTestResult('passed'),
      createTestResult('failed'),
      createTestResult('skipped')
    ];
    const summary = aggregator.generateSummary(results);
    expect(summary.statistic.total).toBe(3);
    expect(summary.statistic.passed).toBe(1);
    expect(summary.statistic.failed).toBe(1);
    expect(summary.statistic.skipped).toBe(1);
    expect(summary.duration).toBe(3000); // 3 results * 1000ms each
  });

  it('should calculate statistic for empty array', () => {
    const statistic = aggregator.calculateStatistic([]);
    expect(statistic.total).toBe(0);
  });

  it('should calculate total duration', () => {
    const results = [
      createTestResult('passed'),
      createTestResult('failed')
    ];
    const duration = aggregator.calculateTotalDuration(results);
    expect(duration).toBe(2000);
  });

  it('should group by status', () => {
    const results = [
      createTestResult('passed'),
      createTestResult('passed'),
      createTestResult('failed')
    ];
    const grouped = aggregator.groupByStatus(results);
    expect(grouped.size).toBe(2);
    // Find the passed and failed status keys by iterating
    let passedResults: TestResult[] | undefined;
    let failedResults: TestResult[] | undefined;
    for (const [status, testResults] of grouped.entries()) {
      if (status.getValue() === 'passed') {
        passedResults = testResults;
      } else if (status.getValue() === 'failed') {
        failedResults = testResults;
      }
    }
    expect(passedResults?.length).toBe(2);
    expect(failedResults?.length).toBe(1);
  });

  it('should group by label', () => {
    const results = [
      createTestResult('passed', [new Label('suite', 'Suite1')]),
      createTestResult('passed', [new Label('suite', 'Suite1')]),
      createTestResult('failed', [new Label('suite', 'Suite2')])
    ];
    const grouped = aggregator.groupByLabel(results, 'suite');
    expect(grouped.size).toBe(2);
    const suite1Results = grouped.get('Suite1');
    expect(suite1Results?.length).toBe(2);
    const suite2Results = grouped.get('Suite2');
    expect(suite2Results?.length).toBe(1);
  });
});
