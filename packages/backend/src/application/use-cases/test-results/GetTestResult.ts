import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { TestResultId } from '../../../domain/value-objects/TestResultId.js';
import { TestResultAdapter } from '../../adapters/TestResultAdapter.js';
import { TestResultResponse } from '../../dto/responses/TestResultResponse.js';

export class GetTestResult {
  constructor(private readonly testResultRepository: ITestResultRepository) {}

  async execute(testResultId: string): Promise<TestResultResponse | null> {
    const id = new TestResultId(testResultId);
    const testResult = await this.testResultRepository.findById(id);

    if (!testResult) {
      return null;
    }

    return TestResultAdapter.toDTO(testResult);
  }
}
