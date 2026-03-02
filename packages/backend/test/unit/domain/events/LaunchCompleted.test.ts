import { describe, it, expect } from 'vitest';
import { LaunchCompleted } from '../../../../src/domain/events/LaunchCompleted.js';
import { LaunchId } from '../../../../src/domain/value-objects/LaunchId.js';
import type { Statistic } from '../../../../src/domain/types/Statistic.js';

describe('LaunchCompleted', () => {
  it('should create event with launch ID, total tests and statistic', () => {
    const launchId = new LaunchId('launch-id');
    const statistic: Statistic = { total: 10, passed: 8, failed: 2 };
    const event = new LaunchCompleted('aggregate-id', launchId, 10, statistic);
    expect(event.getLaunchId()).toBe(launchId);
    expect(event.getTotalTests()).toBe(10);
    expect(event.getStatistic()).toBe(statistic);
  });
});
