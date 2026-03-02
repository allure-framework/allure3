import type { TestResult as TestResultDTO } from '@allurereport/core-api';
import { ITestResultRepository } from '../../domain/repositories/ITestResultRepository.js';
import { LaunchId } from '../../domain/value-objects/LaunchId.js';
import { TestResultAdapter } from '../../application/adapters/TestResultAdapter.js';

export class Allure3ReaderAdapter {
  constructor(private readonly testResultRepository: ITestResultRepository) {}

  async readFromDatabase(launchId: string): Promise<TestResultDTO[]> {
    const id = new LaunchId(launchId);
    const testResults = await this.testResultRepository.findByLaunchId(id);
    return testResults.map((result) => TestResultAdapter.toDTO(result));
  }

  async readFromFiles(filePaths: string[]): Promise<TestResultDTO[]> {
    // This would use @allurereport/reader to parse files
    // For now, return empty array
    // In production, this would:
    // 1. Use AllureReader to parse each file
    // 2. Convert parsed results to DTOs
    // 3. Return array of DTOs
    return [];
  }

  async parseResultFile(filePath: string): Promise<TestResultDTO> {
    // Parse a single result file
    // This would use @allurereport/reader
    throw new Error('File parsing not yet implemented');
  }

  validateResult(result: TestResultDTO): boolean {
    // Validate that result has required fields
    if (!result.id || !result.name || !result.status) {
      return false;
    }
    if (!result.sourceMetadata || !result.sourceMetadata.readerId) {
      return false;
    }
    return true;
  }
}
