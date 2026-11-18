import type { TestStatus } from "../../model.js";
import type { FlakinessAlgorithm } from "./index.js";

const SIGNIFICANT_STATUSES = new Set<TestStatus>(["passed", "failed", "broken"]);

export const retryFailureRateFlakiness: FlakinessAlgorithm = (current, history, options) => {
  const { historyDepth, stabilizationPeriod, retryFailureThreshold } = options;
  if (historyDepth === -1 || !SIGNIFICANT_STATUSES.has(current.status)) {
    return undefined;
  }

  // The entry point selects the raw history slice. Incomplete executions supply
  // neither counts nor a signature; a missing execution ends the window.
  const runs: (TestStatus[] | undefined)[] = [];
  for (const result of history) {
    if (result === undefined) {
      break;
    }
    if (result.id === current.id || !SIGNIFICANT_STATUSES.has(result.status)) {
      continue;
    }
    runs.push(result.retries === undefined ? undefined : [...result.retries, result.status]);
  }
  runs.reverse();
  runs.push([...(current.retries ?? []).map((retry) => retry.status).reverse(), current.status]);

  let anchor = 0;
  let streak = 0;
  let previousSignature: string | undefined;
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index];
    if (run === undefined || !run.every((status) => status === run[0])) {
      streak = 0;
      previousSignature = undefined;
      continue;
    }
    const signature = run.join(",");
    streak = signature === previousSignature ? streak + 1 : 1;
    previousSignature = signature;
    if (streak >= stabilizationPeriod) {
      anchor = index + 1;
    }
  }

  // Count complete executions only after the latest stabilizing block.
  let failures = 0;
  let passes = 0;
  for (let index = anchor; index < runs.length; index++) {
    const run = runs[index];
    if (run === undefined) {
      continue;
    }
    for (const status of run) {
      if (status === "passed") {
        passes++;
      } else if (status === "failed" || status === "broken") {
        failures++;
      }
    }
  }
  const attempts = failures + passes;
  return attempts === 0 ? undefined : failures / attempts > retryFailureThreshold;
};
