import { describe, it, expect, beforeEach } from 'vitest';
import { GetLaunch } from '../../../../../src/application/use-cases/launches/GetLaunch.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';

describe('GetLaunch', () => {
  let mockRepository: ILaunchRepository;
  let useCase: GetLaunch;

  beforeEach(() => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    mockRepository = {
      save: async () => {},
      findById: async (id) => (id.getValue() === 'launch-id' ? launch : null),
      findAll: async () => [],
      findByDateRange: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    useCase = new GetLaunch(mockRepository);
  });

  it('should get launch by ID', async () => {
    const response = await useCase.execute('launch-id');
    expect(response).not.toBeNull();
    expect(response!.id).toBe('launch-id');
    expect(response!.name).toBe('Test Launch');
  });

  it('should return null for non-existent launch', async () => {
    const response = await useCase.execute('non-existent-id');
    expect(response).toBeNull();
  });
});
