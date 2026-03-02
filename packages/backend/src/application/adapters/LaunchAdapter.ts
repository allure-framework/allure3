import { Launch } from '../../domain/entities/Launch.js';
import { LaunchResponse } from '../dto/responses/LaunchResponse.js';
import { CreateLaunchRequest } from '../dto/requests/CreateLaunchRequest.js';
import { ExecutorInfo } from '../../domain/value-objects/ExecutorInfo.js';
import type { Statistic } from '@allurereport/core-api';

/** Safe ISO string for Date (handles invalid dates from DB/TypeORM). */
function toSafeISOString(date: Date | null | undefined): string | null {
  if (date == null) return null;
  const d = date instanceof Date ? date : new Date(date);
  const ts = d.getTime();
  if (Number.isNaN(ts)) return null;
  return d.toISOString();
}

export interface LaunchDTOOverrides {
  statistic?: Statistic;
  testResultsCount?: number;
}

export class LaunchAdapter {
  static toDTO(domain: Launch, overrides?: LaunchDTOOverrides): LaunchResponse {
    const statistic = overrides?.statistic ?? domain.getStatistic();
    const duration = domain.getDuration();
    const executor = domain.getExecutor();
    const startTime = domain.getStartTime();
    const stopTime = domain.getStopTime();

    return {
      id: domain.getId().getValue(),
      name: domain.getName(),
      startTime: toSafeISOString(startTime) ?? new Date(0).toISOString(),
      stopTime: toSafeISOString(stopTime) ?? null,
      executor: executor
        ? {
            name: executor.getName(),
            type: executor.getType(),
            url: executor.getUrl(),
            buildOrder: executor.getBuildOrder(),
            buildName: executor.getBuildName(),
            buildUrl: executor.getBuildUrl(),
            reportName: executor.getReportName(),
            reportUrl: executor.getReportUrl()
          }
        : null,
      environment: domain.getEnvironment(),
      reportUuid: domain.getReportUuid(),
      statistic: this.mapStatistic(statistic),
      testResultsCount: overrides?.testResultsCount ?? domain.getTestResults().length,
      duration: duration
    };
  }

  static fromDTO(dto: CreateLaunchRequest): {
    name: string | undefined;
    executor: ExecutorInfo | null;
    environment: string | null;
    parentLaunchId: string | undefined;
    runKey: string | undefined;
    environmentName: string | undefined;
  } {
    const executor = dto.executor
      ? new ExecutorInfo(
          dto.executor.name || null,
          dto.executor.type || null,
          dto.executor.url || null,
          dto.executor.buildOrder || null,
          dto.executor.buildName || null,
          dto.executor.buildUrl || null,
          dto.executor.reportName || null,
          dto.executor.reportUrl || null
        )
      : null;

    return {
      name: dto.name,
      executor,
      environment: dto.environment || null,
      parentLaunchId: dto.parent_launch_id,
      runKey: dto.run_key,
      environmentName: dto.environment_name
    };
  }

  private static mapStatistic(domain: Statistic): Statistic {
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
}
