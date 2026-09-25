import type { FlakyDetectionConfig, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";

const DEFAULT_HISTORY_DEPTH = 5;
const TRANSITION_HALF_LIFE = 2;
const STABILITY_PRIOR_WEIGHT = 3;
const FLAKY_SCORE_THRESHOLD = 30;
const badStatuses: TestStatus[] = ["failed", "broken"];

/**
 * Detects recent instability from weighted pass/fail transitions.
 *
 * Adapts Nagios's state-flapping detection: newer comparisons receive more weight.
 * This variant uses exponential decay and a stability prior in the denominator
 * to avoid overestimating instability from short histories.
 *
 * @param tr Current execution used as the newest outcome in the score.
 * @param history Previous executions of the test, ordered newest first.
 * @param historyDepth Maximum comparable historical executions; 0 uses all, -1 disables inference.
 * @param includePassedTests Whether to also evaluate currently passed results.
 * @returns Whether the evidence-adjusted transition score reaches the threshold.
 * @see https://assets.nagios.com/downloads/nagioscore/docs/nagioscore/4/en/flapping.html
 */
const isFlakyByWeightedTransitions = (
  tr: TestResult,
  history: HistoryTestResult[],
  historyDepth: number,
  includePassedTests: boolean,
) => {
  const currentPassed = tr.status === "passed";
  const isEligibleStatus = badStatuses.includes(tr.status) || (includePassedTests && currentPassed);

  if (historyDepth === -1 || !isEligibleStatus) {
    return false;
  }

  let previousPassed = currentPassed;
  let comparisons = 0;
  let weightedTransitions = 0;
  let totalWeight = 0;

  for (const result of history) {
    if (historyDepth !== 0 && comparisons >= historyDepth) {
      break;
    }

    if (
      result.id === tr.id ||
      result.environment !== tr.environment ||
      (result.status !== "passed" && !badStatuses.includes(result.status))
    ) {
      continue;
    }

    const passed = result.status === "passed";
    const weight = 2 ** (-comparisons / TRANSITION_HALF_LIFE);

    if (passed !== previousPassed) {
      weightedTransitions += weight;
    }

    totalWeight += weight;
    previousPassed = passed;
    comparisons++;
  }

  // Consume the full window: unchanged outcomes can lower an initially high score.
  // The stability prior keeps a lone transition below the detection threshold.
  const score = (100 * weightedTransitions) / (STABILITY_PRIOR_WEIGHT + totalWeight);

  return score >= FLAKY_SCORE_THRESHOLD;
};

export const createFlakyDetector = ({
  historyDepth = DEFAULT_HISTORY_DEPTH,
  includePassedTests = false,
}: FlakyDetectionConfig = {}): ((tr: TestResult, history: HistoryTestResult[]) => boolean) => {
  return (tr, history) => tr.flaky || isFlakyByWeightedTransitions(tr, history, historyDepth, includePassedTests);
};
