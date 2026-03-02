import type { Summary as DomainSummary } from '../../domain/types/Summary.js';
import { StatisticMapper } from './StatisticMapper.js';

export interface SummaryDTO {
  statistic: {
    total: number;
    failed?: number;
    broken?: number;
    passed?: number;
    skipped?: number;
    unknown?: number;
    retries?: number;
    flaky?: number;
    regressed?: number;
    fixed?: number;
    malfunctioned?: number;
    new?: number;
  };
  duration: number;
  flakyCount: number;
  retriesCount: number;
}

export class SummaryMapper {
  static toDTO(domain: DomainSummary): SummaryDTO {
    return {
      statistic: StatisticMapper.toDTO(domain.statistic),
      duration: domain.duration,
      flakyCount: domain.flakyCount,
      retriesCount: domain.retriesCount
    };
  }
}
