import type { TestLabel } from "./metadata.js";
import type { TestError, TestStatus } from "./model.js";

/**
 * Stores basic history information for particular test result.
 */
export interface HistoryTestResult {
  id: string;
  name: string;
  fullName?: string;

  status: TestStatus;
  error?: TestError;

  start?: number;
  stop?: number;
  duration?: number;

  labels?: TestLabel[];

  // TODO url
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
}
