import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { Status } from '../../../domain/value-objects/Status.js';
import { TestResultAdapter } from '../../adapters/TestResultAdapter.js';
import { TestResultResponse } from '../../dto/responses/TestResultResponse.js';
import { SearchTestResultsRequest } from '../../dto/requests/SearchTestResultsRequest.js';
import { PaginatedResponse, createPaginatedResponse } from '../../dto/responses/PaginatedResponse.js';

export class SearchTestResults {
  constructor(private readonly testResultRepository: ITestResultRepository) {}

  async execute(request: SearchTestResultsRequest): Promise<PaginatedResponse<TestResultResponse>> {
    const page = request.page || 1;
    const limit = request.limit || 20;

    let results: ReadonlyArray<TestResult> = [];

    // Build search query based on filters
    if (request.status) {
      const status = new Status(request.status as any);
      results = await this.testResultRepository.findByStatus(status);
    } else if (request.labelName) {
      results = await this.testResultRepository.findByLabel(request.labelName, request.labelValue);
    }
    // Note: In production, implement findAll() or search() method in repository for full-text search
    // For now, we'll work with empty array if no specific filter is provided

    // Apply full-text search filter if query provided
    // In production, this should be done at repository level with proper indexing
    if (request.query) {
      // For testing purposes, we'll need to get all results first
      // This is a simplified implementation - in production, use repository search method
      if (results.length === 0 && !request.status && !request.labelName) {
        // No results to filter - return empty
        return createPaginatedResponse([], 0, page, limit);
      }
      
      const queryLower = request.query.toLowerCase();
      results = results.filter((result) => {
        const name = result.getName().getValue().toLowerCase();
        const fullName = result.getFullName()?.toLowerCase() || '';
        const description = result.getDescription()?.toLowerCase() || '';
        return name.includes(queryLower) || fullName.includes(queryLower) || description.includes(queryLower);
      });
    }

    // Apply environment filter
    if (request.environment) {
      results = results.filter((result) => result.getEnvironment() === request.environment);
    }

    // Apply date range filter (would need timeRange support in repository)
    // This is simplified - in production, implement at repository level

    // Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedResults = results.slice(start, end);
    const total = results.length;

    const dtos = paginatedResults.map((result) => TestResultAdapter.toDTO(result));

    return createPaginatedResponse(dtos, total, page, limit);
  }
}
