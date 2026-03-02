import { describe, it, expect } from 'vitest';
import { WidgetService } from '../../../../src/application/services/WidgetService.js';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('WidgetService', () => {
  const service = new WidgetService();
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  function createTestResult(status: string = 'passed', flaky: boolean = false): TestResult {
    return new TestResult(
      new TestResultId('test-id'),
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
      flaky,
      false,
      false,
      false,
      null,
      null,
      null,
      [],
      [],
      [],
      [],
      [],
      sourceMetadata,
      null
    );
  }

  it('should generate summary widget', () => {
    const results = [createTestResult('passed'), createTestResult('failed')];
    const widget = service.generateSummaryWidget(results);
    expect(widget.statistic.total).toBe(2);
    expect(widget.duration).toBe(2000);
  });

  it('should generate status widget', () => {
    const results = [createTestResult('passed'), createTestResult('failed')];
    const widget = service.generateStatusWidget(results);
    expect(widget.total).toBe(2);
    expect(widget.passed).toBe(1);
    expect(widget.failed).toBe(1);
  });

  it('should generate duration widget', () => {
    const results = [createTestResult('passed'), createTestResult('failed')];
    const widget = service.generateDurationWidget(results);
    expect(widget.total).toBe(2000);
    expect(widget.average).toBe(1000);
  });

  it('should generate flaky widget', () => {
    const results = [createTestResult('passed', true), createTestResult('failed')];
    const widget = service.generateFlakyWidget(results);
    expect(widget.count).toBe(1);
  });

  it('should generate retries widget', () => {
    const results = [createTestResult('passed'), createTestResult('failed')];
    const widget = service.generateRetriesWidget(results);
    expect(widget.count).toBe(0);
    expect(widget.totalRetries).toBe(0);
  });

  it('should generate all widgets', () => {
    const results = [createTestResult('passed'), createTestResult('failed')];
    const widgets = service.generateAllWidgets(results);
    expect(widgets.size).toBe(5);
    expect(widgets.has('summary')).toBe(true);
    expect(widgets.has('status')).toBe(true);
  });
});
