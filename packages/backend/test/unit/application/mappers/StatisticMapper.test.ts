import { describe, it, expect } from 'vitest';
import { StatisticMapper } from '../../../../src/application/mappers/StatisticMapper.js';
import type { Statistic } from '@allurereport/core-api';

describe('StatisticMapper', () => {
  it('should convert Domain to DTO', () => {
    const domain: Statistic = {
      total: 10,
      passed: 8,
      failed: 1,
      broken: 1,
      skipped: 0,
      unknown: 0,
      retries: 2,
      flaky: 1
    };

    const dto = StatisticMapper.toDTO(domain);
    expect(dto.total).toBe(10);
    expect(dto.passed).toBe(8);
    expect(dto.failed).toBe(1);
  });

  it('should convert DTO to Domain', () => {
    const dto: Statistic = {
      total: 10,
      passed: 8,
      failed: 1,
      broken: 1
    };

    const domain = StatisticMapper.toDomain(dto);
    expect(domain.total).toBe(10);
    expect(domain.passed).toBe(8);
  });
});
