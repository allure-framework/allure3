import type { TestResult as TestResultDTO } from '@allurereport/core-api';
import { ILaunchRepository } from '../../../domain/repositories/ILaunchRepository.js';
import { ITestResultRepository } from '../../../domain/repositories/ITestResultRepository.js';
import { IHistoryRepository } from '../../../domain/repositories/IHistoryRepository.js';
import { LaunchId } from '../../../domain/value-objects/LaunchId.js';
import { TestResultAdapter } from '../../adapters/TestResultAdapter.js';
import { HistoryTracker } from '../../../domain/services/HistoryTracker.js';
import { StatusTransitionCalculator } from '../../../domain/services/StatusTransitionCalculator.js';
import { TestResultUploaded } from '../../../domain/events/TestResultUploaded.js';
import type { AllureStore } from '@allurereport/plugin-api';
import { randomUUID } from 'crypto';

export interface EventBus {
  publish(event: any): Promise<void>;
}

export interface UploadTestResultsResponse {
  uploadedCount: number;
  launchId: string;
}

export class UploadLaunchResults {
  private readonly historyTracker: HistoryTracker;
  private readonly transitionCalculator: StatusTransitionCalculator;

  constructor(
    private readonly launchRepository: ILaunchRepository,
    private readonly testResultRepository: ITestResultRepository,
    private readonly historyRepository: IHistoryRepository,
    private readonly allureStore?: AllureStore,
    private readonly eventBus?: EventBus
  ) {
    this.historyTracker = new HistoryTracker();
    this.transitionCalculator = new StatusTransitionCalculator();
  }

  async execute(launchId: string, results: TestResultDTO[]): Promise<UploadTestResultsResponse> {
    const id = new LaunchId(launchId);
    const launch = await this.launchRepository.findById(id);

    if (!launch) {
      throw new Error('Launch not found');
    }

    if (launch.isCompleted()) {
      throw new Error('Cannot upload results to completed launch');
    }

    let uploadedCount = 0;

    for (const resultDto of results) {
      // Convert DTO to Domain entity
      const testResult = TestResultAdapter.toDomain(resultDto);

      // Find previous test result by historyId if exists
      let previousResult = null;
      if (testResult.getHistoryId()) {
        const previousResults = await this.testResultRepository.findByHistoryId(testResult.getHistoryId()!);
        if (previousResults.length > 0) {
          // Get the most recent one
          previousResult = previousResults.sort((a, b) => {
            const aTime = a.getTimeRange().getStart() || 0;
            const bTime = b.getTimeRange().getStart() || 0;
            return bTime - aTime;
          })[0];
        }
      }

      // Calculate status transition
      const transition = this.transitionCalculator.calculate(
        testResult.getStatus(),
        previousResult ? previousResult.getStatus() : null
      );

      // Save test result FIRST (history needs it to exist due to foreign key)
      // Use saveWithLaunchId because save() requires launchId parameter
      await (this.testResultRepository as any).saveWithLaunchId(testResult, launchId);

      // Create history entry only if historyId exists
      // Must be saved AFTER test_result to satisfy foreign key constraint
      if (testResult.getHistoryId()) {
        const entryId = randomUUID();
        const historyEntry = this.historyTracker.trackTestResult(
          testResult,
          previousResult,
          id,
          entryId
        );

        // Save history entry (test_result must exist first)
        await this.historyRepository.save(historyEntry);
      }

      // Add to AllureStore for plugin compatibility
      if (this.allureStore) {
        // This will be implemented in Infrastructure layer
        // await this.allureStore.addTestResult(resultDto);
      }

      // Add to launch
      launch.addTestResult(testResult);

      // Publish domain event
      if (this.eventBus) {
        const event = new TestResultUploaded(launchId, testResult.getId(), id);
        await this.eventBus.publish(event);
      }

      uploadedCount++;
    }

    // Save launch with updated test results
    await this.launchRepository.save(launch);

    return {
      uploadedCount,
      launchId
    };
  }
}
