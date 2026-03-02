import type { TestEnvGroup } from '@allurereport/core-api';
import { getWorstStatus } from '@allurereport/core-api';
import type { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { LaunchResolutionService } from '../../services/LaunchResolutionService.js';
export class GetTestEnvGroup {
  constructor(
    private readonly testResultRepository: ITestResultRepository,
    private readonly launchResolutionService: LaunchResolutionService
  ) {}

  async execute(testCaseId: string, launchId: string): Promise<TestEnvGroup | null> {
    const launchIds = await this.launchResolutionService.resolveLaunchIdsForRead(launchId);
    const results = await this.testResultRepository.findByTestCaseIdAndLaunchIds(testCaseId, launchIds);

    if (results.length === 0) {
      return null;
    }

    const first = results[0]!;
    const name = first.getName().getValue();
    const fullName = first.getFullName();

    const testResultsByEnv: Record<string, string> = {};
    for (const tr of results) {
      const env = tr.getEnvironment() ?? 'default';
      testResultsByEnv[env] = tr.getId().getValue();
    }

    const status = getWorstStatus(results.map((r) => r.getStatus().getValue() as 'failed' | 'broken' | 'passed' | 'skipped' | 'unknown')) ?? 'passed';

    return {
      id: testCaseId,
      name,
      fullName: fullName ?? undefined,
      status,
      testResultsByEnv,
    };
  }
}
