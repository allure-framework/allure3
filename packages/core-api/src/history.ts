import type { TestLabel } from "./metadata.js";
import type { TestError, TestStatus } from "./model.js";

/**
 * Stores basic history information for particular test result.
 */
export interface HistoryTestResult {
  id: string;
  name: string;
  fullName?: string;

  environment?: string;

  status: TestStatus;
  error?: TestError;

  start?: number;
  stop?: number;
  duration?: number;

  labels?: TestLabel[];

  url: string;

  historyId?: string; // TODO: double check the necessity to have historyId in the history test result
  reportLinks?: any[]; // TODO: add the correct type for previously missing report links
}

/**
 * Stores all the historical information for the single test run.
 */
export interface HistoryDataPoint {
  uuid: string;
  name: string;
  timestamp: number;
  knownTestCaseIds: string[];
  testResults: Record<string, HistoryTestResult>;
  metrics: Record<string, number>;
  url: string;
}

/**
 * Provides ability to load and update report history
 */
export interface AllureHistory {
  readHistory(params?: { branch?: string }): Promise<HistoryDataPoint[]>;
  appendHistory(history: HistoryDataPoint): Promise<void>;
}
