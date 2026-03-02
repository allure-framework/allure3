import { Request, Response } from 'express';
import type { TestResult as TestResultDTO } from '@allurereport/core-api';
import { UploadLaunchResults } from '../../../application/use-cases/test-results/UploadLaunchResults.js';
import { GetTestResult } from '../../../application/use-cases/test-results/GetTestResult.js';
import { ListTestResults } from '../../../application/use-cases/test-results/ListTestResults.js';
import { GetTestResultHistory } from '../../../application/use-cases/test-results/GetTestResultHistory.js';
import { GetTestEnvGroup } from '../../../application/use-cases/test-results/GetTestEnvGroup.js';
import { SearchTestResults } from '../../../application/use-cases/test-results/SearchTestResults.js';
import { SearchTestResultsRequest } from '../../../application/dto/requests/SearchTestResultsRequest.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { createSuccessResponse } from '../types/responses.js';

export class TestResultController {
  constructor(
    private readonly uploadLaunchResults: UploadLaunchResults,
    private readonly getTestResult: GetTestResult,
    private readonly listTestResults: ListTestResults,
    private readonly getTestResultHistory: GetTestResultHistory,
    private readonly getTestEnvGroup: GetTestEnvGroup,
    private readonly searchTestResults: SearchTestResults
  ) {}

  async upload(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    const results: TestResultDTO[] = req.body;
    
    const response = await this.uploadLaunchResults.execute(launch_id, results);
    res.status(201).json(createSuccessResponse(response));
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await this.getTestResult.execute(id);
    
    if (!result) {
      throw new NotFoundError('Test result', id);
    }
    
    res.json(createSuccessResponse(result));
  }

  async list(req: Request, res: Response): Promise<void> {
    const { launch_id } = req.params;
    const environment = req.query.environment as string | undefined;
    const pagination = req.pagination || { page: 1, limit: 20, offset: 0 };
    const filters = req.filters || {};
    
    const options = {
      launchId: launch_id,
      environment,
      status: filters.status,
      labelName: filters.labelName,
      labelValue: filters.labelValue,
      page: pagination.page,
      limit: pagination.limit
    };
    
    const result = await this.listTestResults.execute(options);
    res.json(result);
  }

  async getTestEnvGroupById(req: Request, res: Response): Promise<void> {
    const { testCaseId } = req.params;
    const launch_id = req.query.launch_id as string | undefined;

    if (!launch_id) {
      throw new ValidationError('launch_id query parameter is required');
    }

    const group = await this.getTestEnvGroup.execute(testCaseId, launch_id);
    res.json(createSuccessResponse(group ?? null));
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    
    const history = await this.getTestResultHistory.execute(id);
    const limitedHistory = history.slice(0, limit);
    
    res.json(createSuccessResponse(limitedHistory));
  }

  async search(req: Request, res: Response): Promise<void> {
    const pagination = req.pagination || { page: 1, limit: 20, offset: 0 };
    const filters = req.filters || {};
    
    const searchRequest: SearchTestResultsRequest = {
      query: filters.search,
      status: filters.status as any,
      labelName: filters.labelName,
      labelValue: filters.labelValue,
      page: pagination.page,
      limit: pagination.limit
    };
    
    const result = await this.searchTestResults.execute(searchRequest);
    res.json(result);
  }
}
