import type { HistoryTestResult } from "../../history.js";
import type { TestResult } from "../../model.js";
import type { FlakinessAlgorithm, FlakinessOptions } from "./algorithm.js";
import { PfsFlakinessAlgorithm } from "./pfs.js";
import { StatusChangesFlakinessAlgorithm } from "./status-changes.js";

export type { FlakinessOptions } from "./algorithm.js";

const algorithms = {
  "status-changes": StatusChangesFlakinessAlgorithm,
  "pfs": PfsFlakinessAlgorithm,
} satisfies Record<NonNullable<FlakinessOptions["algorithm"]>, typeof FlakinessAlgorithm>;

/** Validate algorithm settings at report/plugin configuration boundaries. */
export const validateFlakinessScoringOptions = (
  { algorithm, pfsThreshold }: Pick<FlakinessOptions, "algorithm" | "pfsThreshold">,
  scope: string,
): void => {
  if (algorithm !== undefined && (typeof algorithm !== "string" || !Object.hasOwn(algorithms, algorithm))) {
    const names = Object.keys(algorithms)
      .map((name) => `"${name}"`)
      .join(" or ");
    throw new TypeError(`${scope}.algorithm must be ${names}`);
  }
  if (
    pfsThreshold !== undefined &&
    (typeof pfsThreshold !== "number" || !Number.isFinite(pfsThreshold) || pfsThreshold < 0 || pfsThreshold > 1)
  ) {
    throw new RangeError(`${scope}.pfsThreshold must be a finite number between 0 and 1`);
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
  const Algorithm = algorithms[options.algorithm ?? "status-changes"];
  return new Algorithm(current, history, options).isFlaky();
};
