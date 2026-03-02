import { describe, it, expect, beforeEach } from 'vitest';
import { GetWidgetData } from '../../../../../src/application/use-cases/widgets/GetWidgetData.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import type { LaunchResolutionService } from '../../../../../src/application/services/LaunchResolutionService.js';

describe('GetWidgetData', () => {
  let mockTestResultRepository: ITestResultRepository;
  let mockLaunchResolutionService: LaunchResolutionService;
  let useCase: GetWidgetData;

  beforeEach(() => {
    mockTestResultRepository = {
      save: async () => {},
      saveMany: async () => {},
      findById: async () => null,
      findByLaunchId: async () => [],
      findByLaunchIds: async () => [],
      findByHistoryId: async () => [],
      findByStatus: async () => [],
      findByLabel: async () => [],
      findDistinctTagValuesByLaunchIds: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    mockLaunchResolutionService = {
      resolveLaunchIdsForRead: async (launchId: string) => [launchId]
    } as LaunchResolutionService;
    useCase = new GetWidgetData(
      mockTestResultRepository,
      mockLaunchResolutionService,
      undefined,
      undefined,
      undefined
    );
  });

  it('should get widget data', async () => {
    const response = await useCase.execute('summary');
    expect(response).not.toBeNull();
    expect(response!.name).toBe('summary');
  });

  it('should return null for non-existent widget', async () => {
    const response = await useCase.execute('non-existent-widget');
    expect(response).toBeNull();
  });

  it('should get widget data filtered by launch ID', async () => {
    const response = await useCase.execute('summary', 'launch-id');
    expect(response).not.toBeNull();
  });
});
