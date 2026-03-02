import { describe, it, expect, beforeEach } from 'vitest';
import { ListTestResults } from '../../../../../src/application/use-cases/test-results/ListTestResults.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import { TestResult } from '../../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../../src/domain/value-objects/TimeRange.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';
import type { SourceMetadata } from '../../../../../src/domain/types/SourceMetadata.js';

describe('ListTestResults', () => {
  let mockTestResultRepository: ITestResultRepository;
  let mockLaunchRepository: ILaunchRepository;
  let useCase: ListTestResults;
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  beforeEach(() => {
    const testResults = [
      new TestResult(
        new TestResultId('test-1'),
        new TestName('Test 1'),
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
      ),
      new TestResult(
        new TestResultId('test-2'),
        new TestName('Test 2'),
        new Status('failed'),
        new TimeRange(2000, 3000),
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
      )
    ];
    mockTestResultRepository = {
      save: async () => {},
      saveMany: async () => {},
      findById: async () => null,
      findByLaunchId: async () => testResults,
      findByHistoryId: async () => [],
      findByStatus: async (status) => testResults.filter((r) => r.getStatus().getValue() === status.getValue()),
      findByLabel: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    mockLaunchRepository = {
      save: async () => {},
      findById: async () => null,
      findAll: async () => [],
      findByDateRange: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    useCase = new ListTestResults(mockTestResultRepository, mockLaunchRepository);
  });

  it('should list test results by launch ID', async () => {
    const response = await useCase.execute({ launchId: 'launch-id' });
    expect(response.data.length).toBe(2);
    expect(response.total).toBe(2);
  });

  it('should list test results by status', async () => {
    const response = await useCase.execute({ status: 'passed' });
    expect(response.data.length).toBe(1);
    expect(response.data[0].status).toBe('passed');
  });

  it('should paginate test results', async () => {
    const response = await useCase.execute({ launchId: 'launch-id', page: 1, limit: 1 });
    expect(response.data.length).toBe(1);
    expect(response.total).toBe(2);
    expect(response.totalPages).toBe(2);
  });
});
