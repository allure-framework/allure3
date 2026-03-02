import { describe, it, expect, beforeEach } from 'vitest';
import { GetTestResult } from '../../../../../src/application/use-cases/test-results/GetTestResult.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import { TestResult } from '../../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../../src/domain/value-objects/TimeRange.js';
import type { SourceMetadata } from '../../../../../src/domain/types/SourceMetadata.js';

describe('GetTestResult', () => {
  let mockRepository: ITestResultRepository;
  let useCase: GetTestResult;
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  beforeEach(() => {
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
    mockRepository = {
      save: async () => {},
      saveMany: async () => {},
      findById: async (id) => (id.getValue() === 'test-id' ? testResult : null),
      findByLaunchId: async () => [],
      findByHistoryId: async () => [],
      findByStatus: async () => [],
      findByLabel: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    useCase = new GetTestResult(mockRepository);
  });

  it('should get test result by ID', async () => {
    const response = await useCase.execute('test-id');
    expect(response).not.toBeNull();
    expect(response!.id).toBe('test-id');
    expect(response!.name).toBe('Test Name');
  });

  it('should return null for non-existent test result', async () => {
    const response = await useCase.execute('non-existent-id');
    expect(response).toBeNull();
  });
});
