import { describe, it, expect, beforeEach } from 'vitest';
import { CiType } from '@allurereport/core-api';
import { GetLaunchCi } from '../../../../../src/application/use-cases/launches/GetLaunchCi.js';
import type { ILaunchRepository } from '../../../../../src/domain/repositories/ILaunchRepository.js';
import { Launch } from '../../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../../src/domain/value-objects/LaunchId.js';
import { ExecutorInfo } from '../../../../../src/domain/value-objects/ExecutorInfo.js';

const noop = async () => {};
const emptyArray = async () => [];

describe('GetLaunchCi', () => {
  let mockRepository: ILaunchRepository;
  let useCase: GetLaunchCi;

  beforeEach(() => {
    mockRepository = {
      save: noop,
      findById: async () => null,
      findAll: emptyArray,
      findByDateRange: emptyArray,
      findByRunKey: async () => null,
      findChildLaunchIds: emptyArray,
      findChildLaunches: emptyArray,
      delete: noop,
      exists: async () => false
    };
    useCase = new GetLaunchCi(mockRepository);
  });

  it('should return null for non-existent launch', async () => {
    const result = await useCase.execute('non-existent-id');
    expect(result).toBeNull();
  });

  it('should return null when launch has no executor', async () => {
    const launch = new Launch(new LaunchId('launch-id'), 'Test', new Date());
    mockRepository.findById = async (id) =>
      id.getValue() === 'launch-id' ? launch : null;

    const result = await useCase.execute('launch-id');
    expect(result).toBeNull();
  });

  it('should map executor to CiDescriptor', async () => {
    const executor = new ExecutorInfo(
      'Jenkins',
      'jenkins',
      'https://jenkins.example.com',
      null,
      'Build #42',
      'https://jenkins.example.com/build/42',
      null,
      null
    );
    const launch = new Launch(
      new LaunchId('launch-id'),
      'Test',
      new Date(),
      null,
      executor,
      null,
      null,
      null,
      null
    );
    mockRepository.findById = async (id) =>
      id.getValue() === 'launch-id' ? launch : null;

    const result = await useCase.execute('launch-id');
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CiType.Jenkins);
    expect(result!.jobName).toBe('Jenkins');
    expect(result!.jobUrl).toBe('https://jenkins.example.com');
    expect(result!.jobRunName).toBe('Build #42');
    expect(result!.jobRunUrl).toBe('https://jenkins.example.com/build/42');
    expect(result!.detected).toBe(false);
  });

  it('should use parent executor when child has none', async () => {
    const executor = new ExecutorInfo('GitHub', 'github', 'https://github.com');
    const parent = new Launch(
      new LaunchId('parent-id'),
      'Parent',
      new Date(),
      null,
      executor,
      null,
      null,
      null,
      null
    );
    const child = new Launch(
      new LaunchId('child-id'),
      'Child',
      new Date(),
      null,
      null,
      null,
      null,
      new LaunchId('parent-id'),
      null
    );
    mockRepository.findById = async (id) => {
      const v = id.getValue();
      if (v === 'child-id') return child;
      if (v === 'parent-id') return parent;
      return null;
    };

    const result = await useCase.execute('child-id');
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CiType.Github);
    expect(result!.jobName).toBe('GitHub');
  });

  it('should map unknown executor type to Local', async () => {
    const executor = new ExecutorInfo('Custom', 'custom-ci');
    const launch = new Launch(
      new LaunchId('launch-id'),
      'Test',
      new Date(),
      null,
      executor,
      null,
      null,
      null,
      null
    );
    mockRepository.findById = async (id) =>
      id.getValue() === 'launch-id' ? launch : null;

    const result = await useCase.execute('launch-id');
    expect(result).not.toBeNull();
    expect(result!.type).toBe(CiType.Local);
  });
});
