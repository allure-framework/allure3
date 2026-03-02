import { IHistoryRepository } from '../../../domain/repositories/IHistoryRepository.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { TestResultId } from '../../../domain/value-objects/TestResultId.js';
import { HistoryService } from '../../services/HistoryService.js';
import type { HistoryTestResult } from '@allurereport/core-api';

export class GetTestResultHistory {
  private readonly historyService: HistoryService;

  constructor(
    private readonly historyRepository: IHistoryRepository,
    private readonly testResultRepository: ITestResultRepository
  ) {
    this.historyService = new HistoryService(historyRepository);
  }

  async execute(testResultId: string): Promise<HistoryTestResult[]> {
    const id = new TestResultId(testResultId);
    const testResult = await this.testResultRepository.findById(id);

    if (!testResult) {
      throw new Error('Test result not found');
    }

    const historyId = testResult.getHistoryId();
    if (!historyId) {
      return [];
    }

    return this.historyService.getTestHistory(historyId);
  }
}
