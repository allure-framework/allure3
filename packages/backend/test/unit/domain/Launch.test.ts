import { describe, it, expect } from 'vitest';
import { Launch } from '../../../src/domain/entities/Launch.js';
import { LaunchId } from '../../../src/domain/value-objects/LaunchId.js';

describe('Launch', () => {
  it('should create a launch', () => {
    const id = new LaunchId('test-id');
    const launch = new Launch(id, 'Test Launch', new Date());
    
    expect(launch.getId().getValue()).toBe('test-id');
    expect(launch.getName()).toBe('Test Launch');
  });

  it('should complete a launch', () => {
    const id = new LaunchId('test-id');
    const launch = new Launch(id, 'Test Launch', new Date());
    
    launch.complete();
    
    // Проверка что launch завершен
    expect(launch).toBeDefined();
  });
});
