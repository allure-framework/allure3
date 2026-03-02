import { describe, it, expect } from 'vitest';
import { LaunchAdapter } from '../../../../src/application/adapters/LaunchAdapter.js';
import { Launch } from '../../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { ExecutorInfo } from '../../../../src/domain/value-objects/ExecutorInfo.js';

describe('LaunchAdapter', () => {
  it('should convert Domain to DTO', () => {
    const launch = new Launch(
      new LaunchId('launch-id'),
      'Test Launch',
      new Date('2024-01-01T00:00:00Z'),
      null,
      null,
      null,
      null
    );

    const dto = LaunchAdapter.toDTO(launch);
    expect(dto.id).toBe('launch-id');
    expect(dto.name).toBe('Test Launch');
    expect(dto.startTime).toBe('2024-01-01T00:00:00.000Z');
    expect(dto.stopTime).toBeNull();
  });

  it('should convert Domain with executor to DTO', () => {
    const executor = new ExecutorInfo('Jenkins', 'jenkins', 'https://jenkins.example.com');
    const launch = new Launch(
      new LaunchId('launch-id'),
      'Test Launch',
      new Date(),
      null,
      executor,
      'test-env',
      null
    );

    const dto = LaunchAdapter.toDTO(launch);
    expect(dto.executor).not.toBeNull();
    expect(dto.executor?.name).toBe('Jenkins');
    expect(dto.environment).toBe('test-env');
  });

  it('should convert CreateLaunchRequest to domain data', () => {
    const request = {
      name: 'Test Launch',
      executor: {
        name: 'Jenkins',
        type: 'jenkins',
        url: 'https://jenkins.example.com'
      },
      environment: 'test-env'
    };

    const domainData = LaunchAdapter.fromDTO(request);
    expect(domainData.name).toBe('Test Launch');
    expect(domainData.executor).not.toBeNull();
    expect(domainData.environment).toBe('test-env');
  });
});
