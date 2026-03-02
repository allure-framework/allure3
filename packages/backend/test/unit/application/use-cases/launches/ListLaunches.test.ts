import { describe, it, expect, beforeEach } from 'vitest';
import { ListLaunches } from '../../../../../src/application/use-cases/launches/ListLaunches.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';

describe('ListLaunches', () => {
  let mockLaunchRepository: ILaunchRepository;
  let mockTestResultRepository: ITestResultRepository;
  let useCase: ListLaunches;

  beforeEach(() => {
    const launches = [
      new Launch(new LaunchId('launch-1'), 'Launch 1', new Date('2024-01-01')),
      new Launch(new LaunchId('launch-2'), 'Launch 2', new Date('2024-01-02')),
      new Launch(new LaunchId('launch-3'), 'Launch 3', new Date('2024-01-03'))
    ];
    mockLaunchRepository = {
      save: async () => {},
      findById: async () => null,
      findAll: async () => launches,
      findByDateRange: async () => launches,
      findByRunKey: async () => null,
      findChildLaunchIds: async () => [],
      findChildLaunches: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    mockTestResultRepository = {
      save: async () => {},
      saveWithLaunchId: async () => {},
      saveMany: async () => {},
      saveManyWithLaunchId: async () => {},
      findById: async () => null,
      findByLaunchId: async () => [],
      findByLaunchIds: async () => [],
      findByTestCaseIdAndLaunchIds: async () => [],
      findByHistoryId: async () => [],
      findByStatus: async () => [],
      findByLabel: async () => [],
      findDistinctTagValuesByLaunchIds: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    useCase = new ListLaunches(mockLaunchRepository, mockTestResultRepository);
  });

  it('should list all launches', async () => {
    const response = await useCase.execute();
    expect(response.data.length).toBe(3);
    expect(response.total).toBe(3);
    expect(response.page).toBe(1);
  });

  it('should paginate launches', async () => {
    const response = await useCase.execute({ page: 1, limit: 2 });
    expect(response.data.length).toBe(2);
    expect(response.total).toBe(3);
    expect(response.totalPages).toBe(2);
  });

  it('should filter by date range', async () => {
    const response = await useCase.execute({
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-02')
    });
    expect(response.data.length).toBeGreaterThan(0);
  });
});
