import { describe, it, expect } from 'vitest';
import { LaunchFactory } from '../../../../src/domain/factories/LaunchFactory.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import { ExecutorInfo } from '../../../../src/domain/value-objects/ExecutorInfo.js';

describe('LaunchFactory', () => {
  const factory = new LaunchFactory();

  it('should create new launch', () => {
    const launch = factory.create('Test Launch');
    expect(launch.getName()).toBe('Test Launch');
    expect(launch.getId()).toBeInstanceOf(LaunchId);
    expect(launch.isCompleted()).toBe(false);
  });

  it('should create launch with executor', () => {
    const executor = new ExecutorInfo('Jenkins', 'jenkins');
    const launch = factory.create('Test Launch', executor);
    expect(launch.getExecutor()).toBe(executor);
  });

  it('should create launch from existing data', () => {
    const id = new LaunchId('existing-id');
    const startTime = new Date();
    const launch = factory.fromExisting(id, 'Test Launch', startTime);
    expect(launch.getId()).toBe(id);
    expect(launch.getName()).toBe('Test Launch');
    expect(launch.getStartTime()).toBe(startTime);
  });
});
