import type { Statistic as StatisticDTO } from '@allurereport/core-api';
import type { Statistic as DomainStatistic } from '../../domain/types/Statistic.js';

export class StatisticMapper {
  static toDTO(domain: DomainStatistic): StatisticDTO {
    return {
      total: domain.total,
      failed: domain.failed,
      broken: domain.broken,
      passed: domain.passed,
      skipped: domain.skipped,
      unknown: domain.unknown,
      retries: domain.retries,
      flaky: domain.flaky,
      regressed: domain.regressed,
      fixed: domain.fixed,
      malfunctioned: domain.malfunctioned,
      new: domain.new
    };
  }

  static toDomain(dto: StatisticDTO): DomainStatistic {
    return {
      total: dto.total,
      failed: dto.failed,
      broken: dto.broken,
      passed: dto.passed,
      skipped: dto.skipped,
      unknown: dto.unknown,
      retries: dto.retries,
      flaky: dto.flaky,
      regressed: dto.regressed,
      fixed: dto.fixed,
      malfunctioned: dto.malfunctioned,
      new: dto.new
    };
  }
}
