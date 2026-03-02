import { describe, it, expect, beforeEach } from 'vitest';
import { GenerateReport } from '../../../../../src/application/use-cases/reports/GenerateReport.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import type { ITestResultRepository } from '../../../../../src/domain/repositories/ITestResultRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';

describe('GenerateReport', () => {
  let mockLaunchRepository: ILaunchRepository;
  let mockTestResultRepository: ITestResultRepository;
  let useCase: GenerateReport;

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
    useCase = new GenerateReport(mockLaunchRepository, mockTestResultRepository);
  });

  it('should generate HTML report', async () => {
    const response = await useCase.execute('launch-id', { format: 'html' });
    expect(response.launchId).toBe('launch-id');
    expect(response.format).toBe('html');
    expect(response.reportUuid).toBeDefined();
    expect(response.url).toBeDefined();
  });

  it('should generate JSON report', async () => {
    const response = await useCase.execute('launch-id', { format: 'json' });
    expect(response.format).toBe('json');
  });

  it('should default to HTML format', async () => {
    const response = await useCase.execute('launch-id');
    expect(response.format).toBe('html');
  });

  it('should throw error if launch not found', async () => {
    await expect(useCase.execute('non-existent-id')).rejects.toThrow('Launch not found');
  });
});
