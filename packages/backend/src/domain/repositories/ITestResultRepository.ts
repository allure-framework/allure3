import { TestResult } from '../entities/TestResult.js';
import { TestResultId } from '../value-objects/TestResultId.js';
import { LaunchId } from '../value-objects/LaunchId.js';
import { HistoryId } from '../value-objects/HistoryId.js';
import { Status } from '../value-objects/Status.js';

export interface ITestResultRepository {
  save(result: TestResult): Promise<void>;
  saveMany(results: ReadonlyArray<TestResult>): Promise<void>;
  findById(id: TestResultId): Promise<TestResult | null>;
  findByLaunchId(launchId: LaunchId): Promise<TestResult[]>;
  findByLaunchIds(launchIds: string[]): Promise<TestResult[]>;
  findByTestCaseIdAndLaunchIds(testCaseId: string, launchIds: string[]): Promise<TestResult[]>;
  findByHistoryId(historyId: HistoryId): Promise<TestResult[]>;
  findByStatus(status: Status): Promise<TestResult[]>;
  findByLabel(labelName: string, labelValue?: string): Promise<TestResult[]>;
  findDistinctTagValuesByLaunchIds(launchIds: string[]): Promise<string[]>;
  delete(id: TestResultId): Promise<void>;
  exists(id: TestResultId): Promise<boolean>;
}
