import type { TestLabel } from "./metadata.js";
import type { TestError, TestStatus, TestStatusTransition } from "./model.js";

/**
 * Stores basic history information for particular test result.
 */
export interface HistoryTestResult {
  id: string;
  name: string;
  fullName?: string;

  environment?: string;

  status: TestStatus;
  retries?: TestStatus[];
  // Local history persists error details as top-level fields.
  message?: string;
  trace?: string;
  error?: TestError;

  /**
   * The flaky flag and status transition of the result, used to match the result to categories.
   * History points written by older versions don't have them
   */
  flaky?: boolean;
  transition?: TestStatusTransition;

  start?: number;
  stop?: number;
  duration?: number;

  labels?: TestLabel[];

  url: string;

  retryHash?: string;
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

export type HistoryTestResultUrlResolver = (historyUrl: string, pluginId: string, historicalResultId: string) => string;

/**
 * Provides ability to read immutable historical points and append a new report.
 */
export interface AllureHistory {
  readHistory(params?: { repo?: string; branch?: string }): Promise<HistoryDataPoint[]>;
  appendHistory(history: HistoryDataPoint): Promise<void>;
  resolveTestResultUrl?: HistoryTestResultUrlResolver;
}
