import { describe, it, expect, beforeEach } from 'vitest';
import { CreateLaunch } from '../../../../../src/application/use-cases/launches/CreateLaunch.js';
import { LaunchFactory } from '../../../../../src/domain/factories/LaunchFactory.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';

describe('CreateLaunch', () => {
  let mockRepository: ILaunchRepository;
  let useCase: CreateLaunch;
  let launchFactory: LaunchFactory;

  beforeEach(() => {
    mockRepository = {
      save: async () => {},
      findById: async () => null,
      findAll: async () => [],
      findByDateRange: async () => [],
      findByRunKey: async () => null,
      findChildLaunchIds: async () => [],
      findChildLaunches: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    const mockVariablesRepository = {
      findByLaunchId: async () => null,
      save: async () => {}
    };
    launchFactory = new LaunchFactory();
    useCase = new CreateLaunch(mockRepository, launchFactory, mockVariablesRepository);
  });

  it('should create launch', async () => {
    const request = {
      name: 'Test Launch',
      environment: 'test-env'
    };

    const response = await useCase.execute(request);
    expect(response.name).toBe('Test Launch');
    expect(response.id).toBeDefined();
  });

  it('should create launch with executor', async () => {
    const request = {
      name: 'Test Launch',
      executor: {
        name: 'Jenkins',
        type: 'jenkins',
        url: 'https://jenkins.example.com'
      }
    };

    const response = await useCase.execute(request);
    expect(response.executor).not.toBeNull();
    expect(response.executor?.name).toBe('Jenkins');
  });
});
