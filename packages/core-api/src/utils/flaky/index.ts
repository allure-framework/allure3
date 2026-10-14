import type { HistoryTestResult } from "../../history.js";
import type { TestResult } from "../../model.js";
import { DEFAULT_FLAKINESS_OPTIONS, type FlakinessAlgorithm, type FlakinessOptions } from "./algorithm.js";
import { RetryFailureRateFlakinessAlgorithm } from "./retry-failure-rate.js";
import { StatusChangesFlakinessAlgorithm } from "./status-changes.js";

export type { FlakinessOptions } from "./algorithm.js";

const algorithms = {
  "status-changes": StatusChangesFlakinessAlgorithm,
  "retry-failure-rate": RetryFailureRateFlakinessAlgorithm,
} satisfies Record<NonNullable<FlakinessOptions["algorithm"]>, typeof FlakinessAlgorithm>;

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
  const Algorithm = algorithms[options.algorithm ?? DEFAULT_FLAKINESS_OPTIONS.algorithm];
  return new Algorithm(current, history, options).isFlaky();
};
