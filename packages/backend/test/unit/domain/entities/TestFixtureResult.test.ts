import { describe, it, expect } from 'vitest';
import { TestFixtureResult } from '../../../../src/domain/entities/TestFixtureResult.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { TestError } from '../../../../src/domain/value-objects/TestError.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('TestFixtureResult', () => {
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };
  const status = new Status('passed');
  const timeRange = new TimeRange(1000, 2000);

  it('should create TestFixtureResult with type before', () => {
    const fixture = new TestFixtureResult(
      'fixture-id',
      'before',
      'Before Hook',
      status,
      timeRange,
      null,
      [],
      [],
      sourceMetadata
    );
    expect(fixture.getId()).toBe('fixture-id');
    expect(fixture.getType()).toBe('before');
    expect(fixture.getName()).toBe('Before Hook');
    expect(fixture.isBefore()).toBe(true);
    expect(fixture.isAfter()).toBe(false);
  });

  it('should create TestFixtureResult with type after', () => {
    const fixture = new TestFixtureResult(
      'fixture-id',
      'after',
      'After Hook',
      status,
      timeRange,
      null,
      [],
      [],
      sourceMetadata
    );
    expect(fixture.getType()).toBe('after');
    expect(fixture.isBefore()).toBe(false);
    expect(fixture.isAfter()).toBe(true);
  });

  it('should throw error for empty ID', () => {
    expect(() => new TestFixtureResult('', 'before', 'Hook', status, timeRange, null, [], [], sourceMetadata))
      .toThrow('TestFixtureResult ID cannot be empty');
  });

  it('should throw error for empty name', () => {
    expect(() => new TestFixtureResult('fixture-id', 'before', '', status, timeRange, null, [], [], sourceMetadata))
      .toThrow('TestFixtureResult name cannot be empty');
  });

  it('should throw error for invalid type', () => {
    expect(() => new TestFixtureResult('fixture-id', 'invalid' as any, 'Hook', status, timeRange, null, [], [], sourceMetadata))
      .toThrow('Invalid TestFixtureResult type');
  });

  it('should store test result IDs', () => {
    const testResultId1 = new TestResultId('test-result-1');
    const testResultId2 = new TestResultId('test-result-2');
    const fixture = new TestFixtureResult(
      'fixture-id',
      'before',
      'Hook',
      status,
      timeRange,
      null,
      [],
      [testResultId1, testResultId2],
      sourceMetadata
    );
    expect(fixture.getTestResultIds().length).toBe(2);
  });
});
