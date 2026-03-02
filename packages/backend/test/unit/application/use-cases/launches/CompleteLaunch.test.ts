import { describe, it, expect, beforeEach } from 'vitest';
import { CompleteLaunch } from '../../../../../src/application/use-cases/launches/CompleteLaunch.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';
import type { EventBus } from '../../../../../src/application/use-cases/launches/CompleteLaunch.js';

describe('CompleteLaunch', () => {
  let mockRepository: ILaunchRepository;
  let mockEventBus: EventBus;
  let useCase: CompleteLaunch;

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
    mockEventBus = {
      publish: async () => {}
    };
    useCase = new CompleteLaunch(mockRepository, mockEventBus);
  });

  it('should complete launch', async () => {
    const response = await useCase.execute('launch-id');
    expect(response.stopTime).not.toBeNull();
  });

  it('should throw error if launch not found', async () => {
    await expect(useCase.execute('non-existent-id')).rejects.toThrow('Launch not found');
  });

  it('should throw error if launch already completed', async () => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test Launch', new Date());
    launch.complete();
    mockRepository.findById = async () => launch;
    
    await expect(useCase.execute('launch-id')).rejects.toThrow('Launch is already completed');
  });
});
