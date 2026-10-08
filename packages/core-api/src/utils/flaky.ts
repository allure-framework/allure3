import type { FlakyDetectionConfig } from "../config.js";
import type { HistoryTestResult } from "../history.js";
import type { TestResult, TestStatus } from "../model.js";

export type FlakinessOptions = Pick<FlakyDetectionConfig, "historyDepth" | "stabilizationPeriod">;

const SIGNIFICANT_STATUSES = new Set<TestStatus>(["passed", "failed", "broken"]);

/**
 * Classify instability since the latest missing run and stabilization block.
 * True means unstable, false stable, and undefined insufficient/disabled evidence.
 * History must belong to the current retryHash, newest first, retaining missing runs.
 * Callers validate options when configuring the consumer.
 */
export const getTestFlakiness = (
  current: TestResult,
  history: (HistoryTestResult | undefined)[],
  options: FlakinessOptions = {},
): boolean | undefined => {
  const { historyDepth = 10, stabilizationPeriod = 5 } = options;
  if (historyDepth === -1 || !SIGNIFICANT_STATUSES.has(current.status)) {
    return undefined;
  }

  const statuses: TestStatus[] = [];
  for (const result of history) {
    if (result === undefined) {
      break;
    }
    if (result.id === current.id || !SIGNIFICANT_STATUSES.has(result.status)) {
      continue;
    }
    statuses.push(result.status);
    if (historyDepth > 0 && statuses.length === historyDepth) {
      break;
    }
  }
  if (statuses.length === 0) {
    return undefined;
  }
  statuses.reverse();
  statuses.push(current.status);

  const period = historyDepth > 0 ? Math.min(stabilizationPeriod, historyDepth + 1) : stabilizationPeriod;
  let anchor = 0;
  let streak = 0;
  for (let index = 0; index < statuses.length; index++) {
    streak = index > 0 && statuses[index] === statuses[index - 1] ? streak + 1 : 1;
    if (streak >= period) {
      anchor = index;
    }
  }

  let changes = 0;
  for (let index = anchor + 1; index < statuses.length; index++) {
    if (statuses[index] !== statuses[index - 1]) {
      changes++;
    }
  }
  if (changes <= 1) {
    return false;
  }
  // Only P -> F -> P and P -> B -> P tolerate a two-change recovery.
  return !(changes === 2 && statuses[anchor] === "passed" && current.status === "passed");
};
