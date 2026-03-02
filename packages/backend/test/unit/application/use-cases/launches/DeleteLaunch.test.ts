import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteLaunch } from '../../../../../src/application/use-cases/launches/DeleteLaunch.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import type { IAttachmentRepository } from '../../../../../src/domain/repositories/IAttachmentRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';

describe('DeleteLaunch', () => {
  let mockLaunchRepository: ILaunchRepository;
  let mockTestResultRepository: ITestResultRepository;
  let mockAttachmentRepository: IAttachmentRepository;
  let useCase: DeleteLaunch;

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
      saveMany: async () => {},
      findById: async () => null,
      findByLaunchId: async () => [],
      findByHistoryId: async () => [],
      findByStatus: async () => [],
      findByLabel: async () => [],
      delete: async () => {},
      exists: async () => false
    };
    mockAttachmentRepository = {
      save: async () => {},
      findById: async () => null,
      findByUid: async () => null,
      delete: async () => {},
      exists: async () => false
    };
    useCase = new DeleteLaunch(mockLaunchRepository, mockTestResultRepository, mockAttachmentRepository);
  });

  it('should delete launch', async () => {
    await expect(useCase.execute('launch-id')).resolves.not.toThrow();
  });

  it('should throw error if launch not found', async () => {
    await expect(useCase.execute('non-existent-id')).rejects.toThrow('Launch not found');
  });
});
