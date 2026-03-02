import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { LaunchAdapter } from '../../adapters/LaunchAdapter.js';
import { LaunchResponse } from '../../dto/responses/LaunchResponse.js';
import { PaginatedResponse, createPaginatedResponse } from '../../dto/responses/PaginatedResponse.js';
import { TestResultAggregator } from '../../../domain/services/TestResultAggregator.js';
import type { Statistic } from '@allurereport/core-api';

export interface ListLaunchesOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

export class ListLaunches {
  private readonly aggregator = new TestResultAggregator();

  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly testResultRepository: ITestResultRepository
  ) {}

  async execute(options: ListLaunchesOptions = {}): Promise<PaginatedResponse<LaunchResponse>> {
    const page = options.page || 1;
    const limit = options.limit || 20;

    let launches;
    if (options.startDate && options.endDate) {
      launches = await this.launchRepository.findByDateRange(options.startDate, options.endDate);
    } else {
      launches = await this.launchRepository.findAll();
    }

    // Simple pagination (in production, this should be done at repository level)
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedLaunches = launches.slice(start, end);
    const total = launches.length;

    const dtos = await Promise.all(
      paginatedLaunches.map(async (launch) => {
        const childIds = await this.launchRepository.findChildLaunchIds(launch.getId());
        const hasChildren = childIds.length > 0;
        const hasDirectResults = launch.getTestResults().length > 0;

        if (hasChildren && !hasDirectResults) {
          const childLaunchIds = childIds.map((id) => id.getValue());
          const childResults = await this.testResultRepository.findByLaunchIds(childLaunchIds);
          const statistic = this.aggregator.calculateStatistic(childResults) as Statistic;
          return LaunchAdapter.toDTO(launch, {
            statistic,
            testResultsCount: childResults.length
          });
        }

        return LaunchAdapter.toDTO(launch);
      })
    );

    return createPaginatedResponse(dtos, total, page, limit);
  }
}
