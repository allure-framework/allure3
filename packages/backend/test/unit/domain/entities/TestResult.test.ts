import { describe, it, expect } from 'vitest';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { Label } from '../../../../src/domain/value-objects/Label.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('TestResult', () => {
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };
  const testResultId = new TestResultId('test-result-id');
  const testName = new TestName('Test Name');
  const status = new Status('passed');
  const timeRange = new TimeRange(1000, 2000);

  function createTestResult(overrides: {
    flaky?: boolean;
    muted?: boolean;
    known?: boolean;
    hidden?: boolean;
    labels?: Label[];
    retries?: TestResult[];
  } = {}): TestResult {
    return new TestResult(
      testResultId,
      testName,
      status,
      timeRange,
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
      overrides.flaky ?? false,
      overrides.muted ?? false,
      overrides.known ?? false,
      overrides.hidden ?? false,
      null,
      null,
      null,
      overrides.labels ?? [],
      [],
      [],
      [],
      overrides.retries ?? [],
      sourceMetadata,
      null
    );
  }

  it('should create TestResult with minimal fields', () => {
    const result = createTestResult();
    expect(result.getId().getValue()).toBe('test-result-id');
    expect(result.getName().getValue()).toBe('Test Name');
    expect(result.getStatus().getValue()).toBe('passed');
  });

  it('should check if result is flaky', () => {
    const result = createTestResult({ flaky: true });
    expect(result.isFlaky()).toBe(true);
  });

  it('should check if result is muted', () => {
    const result = createTestResult({ muted: true });
    expect(result.isMuted()).toBe(true);
  });

  it('should check if result is known', () => {
    const result = createTestResult({ known: true });
    expect(result.isKnown()).toBe(true);
  });

  it('should check if result is hidden', () => {
    const result = createTestResult({ hidden: true });
    expect(result.isHidden()).toBe(true);
  });

  it('should check if result has retries', () => {
    const retryResult = createTestResult();
    const result = createTestResult({ retries: [retryResult] });
    expect(result.hasRetries()).toBe(true);
    expect(result.getRetriesCount()).toBe(1);
  });

  it('should return false for hasRetries when no retries', () => {
    const result = createTestResult();
    expect(result.hasRetries()).toBe(false);
    expect(result.getRetriesCount()).toBe(0);
  });

  it('should find label by name', () => {
    const label = new Label('suite', 'MySuite');
    const result = createTestResult({ labels: [label] });
    const found = result.findLabelByName('suite');
    expect(found).not.toBeNull();
    expect(found!.getValue()).toBe('MySuite');
  });

  it('should return null when label not found', () => {
    const result = createTestResult();
    expect(result.findLabelByName('nonexistent')).toBeNull();
  });

  it('should find all labels by name', () => {
    const label1 = new Label('tag', 'tag1');
    const label2 = new Label('tag', 'tag2');
    const result = createTestResult({ labels: [label1, label2] });
    const found = result.findLabelsByName('tag');
    expect(found.length).toBe(2);
  });

  it('should check if result has label', () => {
    const label = new Label('suite', 'MySuite');
    const result = createTestResult({ labels: [label] });
    expect(result.hasLabel('suite')).toBe(true);
    expect(result.hasLabel('suite', 'MySuite')).toBe(true);
    expect(result.hasLabel('suite', 'OtherSuite')).toBe(false);
  });
});
