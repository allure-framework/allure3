export type DefaultLabelsConfig = Record<string, string | string[]>;

export type FlakyDetectionConfig = {
  /** History classifier. Defaults to the status-change heuristic. */
  algorithm?: "status-changes" | "retry-failure-rate";
  /** Pooled retry failure rate must strictly exceed this value. Range [0, 1], default 0.1. */
  retryFailureThreshold?: number;
  /**
   * Maximum number of previous history entries selected before classification.
   * Positive values select history.slice(0, historyDepth); skipped, unknown,
   * incomplete, and duplicate entries occupy positions in that slice.
   * The current execution is assessed separately and does not consume the limit.
   * A missing test resets the calculation; only executions since the latest gap count.
   * Must be an integer greater than or equal to -1. Defaults to 0 (unlimited).
   * 0 selects the whole history array; -1 disables history inference.
   */
  historyDepth?: number;
  /**
   * Consecutive identical outcomes that reset earlier instability. The status-change
   * heuristic compares final statuses; retry failure rate stabilizes only identical
   * uniform retry-plus-final sequences and discards the streak and all older evidence.
   * Mixed attempt sequences do not stabilize and remain in the calculation.
   * Must be a positive integer, less than a positive historyDepth. Defaults to 5.
   */
  stabilizationPeriod?: number;
  /**
   * Also infer flakiness from history for currently passed tests. Defaults to false.
   * Currently skipped and unknown tests remain ineligible for history-based inference.
   */
  includePassedTests?: boolean;
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
