import { TestResult } from '../../../domain/entities/TestResult.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { LaunchResolutionService } from '../../services/LaunchResolutionService.js';
import { Status } from '../../../domain/value-objects/Status.js';
import { TestResultAdapter } from '../../adapters/TestResultAdapter.js';
import { TestResultResponse } from '../../dto/responses/TestResultResponse.js';
import { PaginatedResponse, createPaginatedResponse } from '../../dto/responses/PaginatedResponse.js';

export interface ListTestResultsOptions {
  launchId?: string;
  environment?: string;
  status?: string;
  labelName?: string;
  labelValue?: string;
  page?: number;
  limit?: number;
}

export class ListTestResults {
  constructor(
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchResolutionService: LaunchResolutionService
  ) {}

  async execute(options: ListTestResultsOptions = {}): Promise<PaginatedResponse<TestResultResponse>> {
    const page = options.page || 1;
    const limit = options.limit || 20;

    let results: TestResult[];

    if (options.launchId) {
      const launchIds = await this.launchResolutionService.resolveLaunchIdsForRead(
        options.launchId,
        options.environment
      );
      results = await this.testResultRepository.findByLaunchIds(launchIds);
    } else if (options.status) {
      const status = new Status(options.status as any);
      results = await this.testResultRepository.findByStatus(status);
    } else if (options.labelName) {
      results = await this.testResultRepository.findByLabel(options.labelName, options.labelValue);
    } else {
      // Get all results (in production, this should have pagination at repository level)
      results = [];
    }

    // Simple pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedResults = results.slice(start, end);
    const total = results.length;

    const dtos = paginatedResults.map((result) => TestResultAdapter.toDTO(result));

    return createPaginatedResponse(dtos, total, page, limit);
  }
}
