import { describe, it, expect } from 'vitest';
import { SummaryMapper } from '../../../../src/application/mappers/SummaryMapper.js';
import type { Summary } from '../../../../src/domain/types/Summary.js';

describe('SummaryMapper', () => {
  it('should convert Domain to DTO', () => {
    const domain: Summary = {
      statistic: {
        total: 10,
        passed: 8,
        failed: 1,
        broken: 1
      },
      duration: 5000,
      flakyCount: 1,
      retriesCount: 2
    };

    const dto = SummaryMapper.toDTO(domain);
    expect(dto.statistic.total).toBe(10);
    expect(dto.duration).toBe(5000);
    expect(dto.flakyCount).toBe(1);
    expect(dto.retriesCount).toBe(2);
  });
});
