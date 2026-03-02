import { describe, it, expect, beforeEach } from 'vitest';
import { Launch } from '../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { TestResultId } from '../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../src/domain/value-objects/TimeRange.js';
import { TestResult } from '../../../../src/domain/entities/TestResult.js';
import type { SourceMetadata } from '../../../../src/domain/types/SourceMetadata.js';

describe('Launch', () => {
  let launch: Launch;
  let launchId: LaunchId;

  beforeEach(() => {
    launchId = new LaunchId('test-launch-id');
    launch = new Launch(launchId, 'Test Launch', new Date());
  });

  it('should create launch', () => {
    expect(launch.getId().getValue()).toBe('test-launch-id');
    expect(launch.getName()).toBe('Test Launch');
    expect(launch.isCompleted()).toBe(false);
  });

  it('should complete launch', () => {
    launch.complete();
    expect(launch.isCompleted()).toBe(true);
    expect(launch.getStopTime()).not.toBeNull();
  });

  it('should throw error when completing already completed launch', () => {
    launch.complete();
    expect(() => launch.complete()).toThrow('Launch is already completed');
  });

  it('should calculate duration after completion', () => {
    const startTime = new Date();
    const launch = new Launch(launchId, 'Test Launch', startTime);
    launch.complete();
    const duration = launch.getDuration();
    expect(duration).not.toBeNull();
    expect(duration! >= 0).toBe(true);
  });

  it('should return null duration for incomplete launch', () => {
    expect(launch.getDuration()).toBeNull();
  });

  it('should add test result', () => {
    const testResult = createTestResult();
    launch.addTestResult(testResult);
    expect(launch.getTestResults().length).toBe(1);
  });

  it('should not allow adding test result after completion', () => {
    launch.complete();
    const testResult = createTestResult();
    expect(() => launch.addTestResult(testResult)).toThrow('Cannot add test result to completed launch');
  });

  it('should remove test result', () => {
    const testResult = createTestResult();
    launch.addTestResult(testResult);
    launch.removeTestResult(testResult.getId());
    expect(launch.getTestResults().length).toBe(0);
  });

  it('should calculate statistic', () => {
    const passedResult = createTestResult('passed');
    const failedResult = createTestResult('failed');
    launch.addTestResult(passedResult);
    launch.addTestResult(failedResult);
    
    const statistic = launch.getStatistic();
    expect(statistic.total).toBe(2);
    expect(statistic.passed).toBe(1);
    expect(statistic.failed).toBe(1);
  });

  it('should return empty statistic for launch without results', () => {
    const statistic = launch.getStatistic();
    expect(statistic.total).toBe(0);
  });

  function createTestResult(status: string = 'passed'): TestResult {
    const testResultId = new TestResultId('test-result-id');
    const testName = new TestName('Test Name');
    const testStatus = new Status(status as any);
    const timeRange = new TimeRange(1000, 2000);
    const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };
    
    return new TestResult(
      testResultId,
      testName,
      testStatus,
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
  }
});
