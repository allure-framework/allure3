import { describe, it, expect } from 'vitest';
import { BusinessRules } from '../../../../src/domain/rules/BusinessRules.js';
import { Launch } from '../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('BusinessRules', () => {
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  it('should validate launch completion', () => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    expect(() => BusinessRules.validateLaunchCompletion(launch)).not.toThrow();
  });

  it('should throw error when validating completion of already completed launch', () => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    launch.complete();
    expect(() => BusinessRules.validateLaunchCompletion(launch)).toThrow('Launch is already completed');
  });

  it('should validate test result addition', () => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    const testResult = new TestResult(
      new TestResultId('test-id'),
      new TestName('Test Name'),
      new Status('passed'),
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
      [],
      [],
      [],
      [],
      [],
      sourceMetadata,
      null
    );
    expect(() => BusinessRules.validateTestResultAddition(launch, testResult)).not.toThrow();
  });

  it('should throw error when adding result to completed launch', () => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    launch.complete();
    const testResult = new TestResult(
      new TestResultId('test-id'),
      new TestName('Test Name'),
      new Status('passed'),
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
      [],
      [],
      [],
      [],
      [],
      sourceMetadata,
      null
    );
    expect(() => BusinessRules.validateTestResultAddition(launch, testResult))
      .toThrow('Cannot add test result to completed launch');
  });

  it('should validate status transition', () => {
    const from = new Status('passed');
    const to = new Status('failed');
    expect(BusinessRules.validateStatusTransition(from, to)).toBe(true);
  });
});
