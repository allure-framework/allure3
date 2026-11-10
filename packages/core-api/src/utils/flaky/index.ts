import type { FlakyDetectionConfig } from "../../config.js";
import type { HistoryTestResult } from "../../history.js";
import type { TestResult } from "../../model.js";
import { retryFailureRateFlakiness } from "./retry-failure-rate.js";
import { statusChangesFlakiness } from "./status-changes.js";

export type FlakinessOptions = Pick<
  FlakyDetectionConfig,
  "algorithm" | "retryFailureThreshold" | "historyDepth" | "stabilizationPeriod"
>;

export const DEFAULT_FLAKINESS_OPTIONS: Readonly<Required<FlakinessOptions>> = {
  algorithm: "status-changes",
  historyDepth: 0,
  stabilizationPeriod: 5,
  retryFailureThreshold: 0.1,
};

export type FlakinessAlgorithm = (
  current: TestResult,
  history: (HistoryTestResult | undefined)[],
  options: Required<FlakinessOptions>,
) => boolean | undefined;

const algorithms = {
  "status-changes": statusChangesFlakiness,
  "retry-failure-rate": retryFailureRateFlakiness,
} satisfies Record<NonNullable<FlakinessOptions["algorithm"]>, FlakinessAlgorithm>;

/** Validate algorithm settings at report/plugin configuration boundaries. */
export const validateFlakinessScoringOptions = (
  { algorithm, retryFailureThreshold, historyDepth, stabilizationPeriod }: FlakinessOptions,
  scope: string,
): void => {
  if (algorithm !== undefined && (typeof algorithm !== "string" || !Object.hasOwn(algorithms, algorithm))) {
    const names = Object.keys(algorithms)
      .map((name) => `"${name}"`)
      .join(" or ");
    throw new TypeError(`${scope}.algorithm must be ${names}`);
  }
  if (
    retryFailureThreshold !== undefined &&
    (typeof retryFailureThreshold !== "number" ||
      !Number.isFinite(retryFailureThreshold) ||
      retryFailureThreshold < 0 ||
      retryFailureThreshold > 1)
  ) {
    throw new RangeError(`${scope}.retryFailureThreshold must be a finite number between 0 and 1`);
  }
  const depth = historyDepth ?? DEFAULT_FLAKINESS_OPTIONS.historyDepth;
  const period = stabilizationPeriod ?? DEFAULT_FLAKINESS_OPTIONS.stabilizationPeriod;
  if (depth > 0 && period >= depth) {
    throw new RangeError(`${scope}.stabilizationPeriod must be less than the positive history limit`);
  }
};

/**
 * Classify instability since the latest missing run and stabilization block.
 * True means unstable, false stable, and undefined insufficient/disabled evidence.
 */
export const getTestFlakiness = (
  current: TestResult,
  history: (HistoryTestResult | undefined)[],
  options: FlakinessOptions = {},
): boolean | undefined => {
  const resolvedOptions: Required<FlakinessOptions> = {
    algorithm: options.algorithm ?? DEFAULT_FLAKINESS_OPTIONS.algorithm,
    historyDepth: options.historyDepth ?? DEFAULT_FLAKINESS_OPTIONS.historyDepth,
    stabilizationPeriod: options.stabilizationPeriod ?? DEFAULT_FLAKINESS_OPTIONS.stabilizationPeriod,
    retryFailureThreshold: options.retryFailureThreshold ?? DEFAULT_FLAKINESS_OPTIONS.retryFailureThreshold,
  };
  const algorithm = algorithms[resolvedOptions.algorithm];
  const selectedHistory = resolvedOptions.historyDepth > 0 ? history.slice(0, resolvedOptions.historyDepth) : history;
  return algorithm(current, selectedHistory, resolvedOptions);
};
