import { describe, it, expect, beforeEach } from 'vitest';
import { UploadLaunchResults } from '../../../../../src/application/use-cases/test-results/UploadLaunchResults.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import type { IHistoryRepository } from '../../../../../src/domain/repositories/IHistoryRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';
import type { TestResult as TestResultDTO } from '@allurereport/core-api';
import type { EventBus } from '../../../../../src/application/use-cases/test-results/UploadLaunchResults.js';

describe('UploadLaunchResults', () => {
  let mockLaunchRepository: ILaunchRepository;
  let mockTestResultRepository: ITestResultRepository;
  let mockHistoryRepository: IHistoryRepository;
  let mockEventBus: EventBus;
  let useCase: UploadLaunchResults;

  beforeEach(() => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    mockLaunchRepository = {
      save: async () => {},
      findById: async (id) => (id.getValue() === 'launch-id' ? launch : null),
      findAll: async () => [],
      findByDateRange: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    mockTestResultRepository = {
      save: async () => {},
      saveWithLaunchId: async () => {},
      saveMany: async () => {},
      findById: async () => null,
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
    mockEventBus = {
      publish: async () => {}
    };
    useCase = new UploadLaunchResults(
      mockLaunchRepository,
      mockTestResultRepository,
      mockHistoryRepository,
      undefined,
      mockEventBus
    );
  });

  it('should upload test results', async () => {
    const results: TestResultDTO[] = [
      {
        id: 'test-1',
        name: 'Test 1',
        status: 'passed',
        flaky: false,
        muted: false,
        known: false,
        hidden: false,
        labels: [],
        parameters: [],
        links: [],
        steps: [],
        sourceMetadata: { readerId: 'test', metadata: {} }
      }
    ];

    const response = await useCase.execute('launch-id', results);
    expect(response.uploadedCount).toBe(1);
    expect(response.launchId).toBe('launch-id');
  });

  it('should throw error if launch not found', async () => {
    const results: TestResultDTO[] = [];
    await expect(useCase.execute('non-existent-id', results)).rejects.toThrow('Launch not found');
  });

  it('should throw error if launch is completed', async () => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    launch.complete();
    mockLaunchRepository.findById = async () => launch;

    const results: TestResultDTO[] = [];
    await expect(useCase.execute('launch-id', results)).rejects.toThrow('Cannot upload results to completed launch');
  });
});
