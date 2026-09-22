import type { HistoryTestResult } from "./history.js";
import type { TestResult } from "./model.js";

export type DefaultLabelsConfig = Record<string, string | string[]>;

export type FlakyDetectionConfig = {
  /**
   * Maximum number of historical results used by the built-in algorithm.
   * Must be a non-negative integer. Defaults to 5; 0 disables history-based inference.
   * Ignored if overrideFunction is set.
   */
  historyDepth?: number;
  /**
   * Replaces the built-in decision, including the integration's flaky flag.
   * Receives all loaded history for the test, newest first, or [] when unavailable.
   * May return a boolean or a promise resolving to a boolean.
   */
  overrideFunction?: (testResult: TestResult, history: HistoryTestResult[]) => boolean | Promise<boolean>;
};

export const parseIntegerConfigValue = (value: unknown, minValue?: number): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);

  return minValue === undefined || normalized >= minValue ? normalized : undefined;
};

export type AllureServiceConfig = {
  accessToken?: string;
  private?: boolean;
  uploadConcurrency?: number;
  uploadMaxAttempts?: number;
  uploadMaxSimultaneousFailures?: number;
};

export type ResolvedAllureServiceConfig = AllureServiceConfig &
  Required<Pick<AllureServiceConfig, "uploadMaxAttempts" | "uploadMaxSimultaneousFailures">>;
