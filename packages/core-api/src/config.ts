export type DefaultLabelsConfig = Record<string, string | string[]>;

export type FlakyDetectionConfig = {
  /** History classifier. Defaults to the status-change heuristic. */
  algorithm?: "status-changes" | "pfs";
  /** Posterior-mean PFS must strictly exceed this value. Range [0, 1], default 0.1. */
  pfsThreshold?: number;
  /**
   * Maximum number of comparable historical executions used by the built-in algorithm.
   * Counts passed, failed, and broken results in the current environment; skipped,
   * unknown, and other environments do not consume the limit.
   * The current execution is assessed separately and is not counted against this limit.
   * A missing test resets the calculation; only executions since the latest gap count.
   * Must be an integer greater than or equal to -1. Defaults to 10.
   * 0 uses all comparable history since the latest gap; -1 disables history inference.
   */
  historyDepth?: number;
  /**
   * Consecutive identical outcomes that reset earlier instability. The status-change
   * heuristic compares final statuses; PFS compares entire retry-plus-final sequences
   * and retains the full stabilizing streak as evidence.
   * Must be an integer greater than or equal to 1. Defaults to 5.
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
