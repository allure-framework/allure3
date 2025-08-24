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

  url: string;
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
  readHistory(branch?: string): Promise<HistoryDataPoint[]>;
  appendHistory(history: HistoryDataPoint, branch?: string): Promise<void>;
}

export const limitHistoryDataPoints = (historyDataPoints: HistoryDataPoint[], limit: number): HistoryDataPoint[] => {
  if (limit <= 0 || historyDataPoints.length === 0) {
    return [];
  }

  const clampedLimit = Math.max(0, Math.floor(limit));

  return historyDataPoints.slice(0, clampedLimit);
};

export const sortHistoryDataPoints = (historyDataPoints: HistoryDataPoint[], order: "asc" | "desc" = "desc"): HistoryDataPoint[] => {
  return historyDataPoints.sort((a, b) => {
    if (order === "asc") {
      return a.timestamp - b.timestamp;
    }

    return b.timestamp - a.timestamp;
  });
};
