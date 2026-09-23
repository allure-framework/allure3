import type { HistoryTestResult } from "./history.js";
import type { TestResult } from "./model.js";

export type DefaultLabelsConfig = Record<string, string | string[]>;

export type FlakyDetectionConfig = {
  /**
   * Maximum number of comparable historical executions used by the built-in algorithm.
   * Counts passed, failed, and broken results in the current environment; skipped,
   * unknown, and other environments do not consume the limit.
   * The current execution is scored separately and is not counted against this limit.
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
