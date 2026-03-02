import { describe, it, expect } from 'vitest';
import { TestResultBuilder } from '../../../../src/domain/factories/TestResultBuilder.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { Label } from '../../../../src/domain/value-objects/Label.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('TestResultBuilder', () => {
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  it('should build TestResult with required fields', () => {
    const builder = new TestResultBuilder();
    const result = builder
      .withId(new TestResultId('test-id'))
      .withName(new TestName('Test Name'))
      .withStatus(new Status('passed'))
      .withTimeRange(new TimeRange(1000, 2000))
      .withSourceMetadata(sourceMetadata)
      .build();
    expect(result.getId().getValue()).toBe('test-id');
    expect(result.getName().getValue()).toBe('Test Name');
  });

  it('should throw error when required field is missing', () => {
    const builder = new TestResultBuilder();
    expect(() => builder.build()).toThrow('TestResultId is required');
  });

  it('should build TestResult with labels', () => {
    const builder = new TestResultBuilder();
    const labels = [new Label('suite', 'MySuite')];
    const result = builder
      .withId(new TestResultId('test-id'))
      .withName(new TestName('Test Name'))
      .withStatus(new Status('passed'))
      .withTimeRange(new TimeRange(1000, 2000))
      .withLabels(labels)
      .withSourceMetadata(sourceMetadata)
      .build();
    expect(result.getLabels().length).toBe(1);
  });
});
