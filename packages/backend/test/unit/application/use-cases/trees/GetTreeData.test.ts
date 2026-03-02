import { describe, it, expect, beforeEach } from 'vitest';
import { GetTreeData } from '../../../../../src/application/use-cases/trees/GetTreeData.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';

describe('GetTreeData', () => {
  let mockTestResultRepository: ITestResultRepository;
  let mockLaunchRepository: ILaunchRepository;
  let useCase: GetTreeData;

  beforeEach(() => {
    mockTestResultRepository = {
      save: async () => {},
      saveMany: async () => {},
      findById: async () => null,
      findByLaunchId: async () => [],
      findByHistoryId: async () => [],
      findByStatus: async () => [],
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
    useCase = new GetTreeData(mockTestResultRepository, mockLaunchRepository);
  });

  it('should get suites tree', async () => {
    const response = await useCase.execute('suites');
    expect(response.type).toBe('suites');
    expect(response.root).toBeDefined();
    expect(response.root.name).toBe('Suites');
  });

  it('should get packages tree', async () => {
    const response = await useCase.execute('packages');
    expect(response.type).toBe('packages');
    expect(response.root).toBeDefined();
    expect(response.root.name).toBe('Packages');
  });

  it('should get behaviors tree', async () => {
    const response = await useCase.execute('behaviors');
    expect(response.type).toBe('behaviors');
    expect(response.root).toBeDefined();
    expect(response.root.name).toBe('Behaviors');
  });

  it('should throw error for invalid tree type', async () => {
    await expect(useCase.execute('invalid' as any)).rejects.toThrow('Invalid tree type');
  });

  it('should get tree data filtered by launch ID', async () => {
    const response = await useCase.execute('suites', 'launch-id');
    expect(response).toBeDefined();
  });
});
