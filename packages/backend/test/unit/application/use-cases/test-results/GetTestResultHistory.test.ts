import { describe, it, expect, beforeEach } from 'vitest';
import { GetTestResultHistory } from '../../../../../src/application/use-cases/test-results/GetTestResultHistory.js';
import type { IHistoryRepository } from '../../../../../src/domain/repositories/IHistoryRepository.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import { TestResult } from '../../../../../src/domain/entities/TestResult.js';
import { TestResultId } from '../../../../../src/domain/value-objects/TestResultId.js';
import { TestName } from '../../../../../src/domain/value-objects/TestName.js';
import { Status } from '../../../../../src/domain/value-objects/Status.js';
import { TimeRange } from '../../../../../src/domain/value-objects/TimeRange.js';
import { HistoryId } from '../../../../../src/domain/value-objects/HistoryId.js';
import type { SourceMetadata } from '../../../../../src/domain/types/SourceMetadata.js';

describe('GetTestResultHistory', () => {
  let mockHistoryRepository: IHistoryRepository;
  let mockTestResultRepository: ITestResultRepository;
  let useCase: GetTestResultHistory;
  const sourceMetadata: SourceMetadata = { readerId: 'test', metadata: {} };

  beforeEach(() => {
    const testResult = new TestResult(
      new TestResultId('test-id'),
      new TestName('Test Name'),
      new Status('passed'),
      new TimeRange(1000, 2000),
      null,
      new HistoryId('history-id'),
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
    mockTestResultRepository = {
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
    mockHistoryRepository = {
      save: async () => {},
      findByHistoryId: async () => [],
      findByTestResultId: async () => [],
      findLatestByHistoryId: async () => null,
      delete: async () => {}
    };
    useCase = new GetTestResultHistory(mockHistoryRepository, mockTestResultRepository);
  });

  it('should get test result history', async () => {
    const history = await useCase.execute('test-id');
    expect(Array.isArray(history)).toBe(true);
  });

  it('should return empty array if test result has no historyId', async () => {
    const testResultWithoutHistory = new TestResult(
      new TestResultId('test-id-2'),
      new TestName('Test Name'),
      new Status('passed'),
      new TimeRange(1000, 2000),
      null,
      null, // No historyId
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
    mockTestResultRepository.findById = async () => testResultWithoutHistory;

    const history = await useCase.execute('test-id-2');
    expect(history).toEqual([]);
  });

  it('should throw error if test result not found', async () => {
    await expect(useCase.execute('non-existent-id')).rejects.toThrow('Test result not found');
  });
});
