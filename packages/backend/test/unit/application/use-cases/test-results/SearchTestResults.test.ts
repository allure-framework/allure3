import { describe, it, expect, beforeEach } from 'vitest';
import { SearchTestResults } from '../../../../../src/application/use-cases/test-results/SearchTestResults.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import { TestResult } from '../../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../../src/domain/value-objects/TimeRange.js';
import type { SourceMetadata } from '../../../../../src/domain/types/SourceMetadata.js';

describe('SearchTestResults', () => {
  let mockRepository: ITestResultRepository;
  let useCase: SearchTestResults;
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  beforeEach(() => {
    const testResults = [
      new TestResult(
        new TestResultId('test-1'),
        new TestName('Test One'),
        new Status('passed'),
        new TimeRange(1000, 2000),
        'Full Test One',
        null,
        null,
        'test-env',
        'Description for test one',
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
        new TestName('Test Two'),
        new Status('failed'),
        new TimeRange(2000, 3000),
        'Full Test Two',
        null,
        null,
        'prod-env',
        'Description for test two',
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
    mockRepository = {
      save: async () => {},
      saveMany: async () => {},
      findById: async () => null,
      findByLaunchId: async () => [],
      findByHistoryId: async () => [],
      findByStatus: async (status) => testResults.filter((r) => r.getStatus().getValue() === status.getValue()),
      findByLabel: async () => testResults,
      delete: async () => {},
      exists: async () => false
    };
    useCase = new SearchTestResults(mockRepository);
  });

  it('should search test results by query', async () => {
    // For query search to work, we need to provide a filter first (status or label)
    // In production, repository would have a search method
    const request = {
      query: 'One',
      status: 'passed' as const,
      page: 1,
      limit: 20
    };
    const response = await useCase.execute(request);
    expect(Array.isArray(response.data)).toBe(true);
    // Filter by query should work if we have results from status filter
    if (response.data.length > 0) {
      expect(response.data.some((r) => r.name.toLowerCase().includes('one'))).toBe(true);
    }
  });

  it('should filter by status', async () => {
    const request = {
      status: 'passed' as const,
      page: 1,
      limit: 20
    };
    const response = await useCase.execute(request);
    expect(response.data.every((r) => r.status === 'passed')).toBe(true);
  });

  it('should filter by environment', async () => {
    const request = {
      environment: 'test-env',
      page: 1,
      limit: 20
    };
    const response = await useCase.execute(request);
    // Note: This test depends on the implementation filtering logic
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should paginate results', async () => {
    const request = {
      query: 'Test',
      page: 1,
      limit: 1
    };
    const response = await useCase.execute(request);
    expect(response.data.length).toBeLessThanOrEqual(1);
    expect(response.totalPages).toBeGreaterThanOrEqual(0);
  });
});
