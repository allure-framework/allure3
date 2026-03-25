import type {
  AllureChartsStoreData,
  StabilityDistributionChartData,
  StabilityDistributionChartOptions,
} from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";

import { createHashStorage, createMapWithDefault } from "./utils.js";

const DEFAULT_LIMIT = 10;
const DEFAULT_STABILIZATION_PERIOD = 5;
const DEFAULT_THRESHOLD = 90;
const DEFAULT_GROUP_BY = "feature";
const CUSTOM_LABEL_NAME_PREFIX = "label-name:";

/** Only these statuses participate in stability; skipped/unknown are ignored. */
const SIGNIFICANT_STATUSES = new Set<TestStatus>(["passed", "failed", "broken"]);

const isSignificantStatus = (status: TestStatus): boolean => SIGNIFICANT_STATUSES.has(status);

const getTrLabelValue = (testResult: TestResult | HistoryTestResult, labelName: string) => {
  return testResult.labels?.find((label) => label.name === labelName)?.value;
};

const NON_SIGNIFICANT_STATUSES: TestStatus[] = ["unknown", "skipped"];

/**
 * Finds the latest (rightmost) block of `blockSize` consecutive same statuses in the sequence.
 * @returns End index (0-based) of the block and the status, or null if no such block exists
 */
const findLatestConsecutiveSameBlock = (
  statuses: TestStatus[],
  sequenceLength: number,
  blockSize: number,
): { endIndex: number; status: TestStatus } | null => {
  for (let start = sequenceLength - blockSize; start >= 0; start--) {
    const first = statuses[start];
    let allSame = true;
    for (let k = 1; k < blockSize; k++) {
      if (statuses[start + k] !== first) {
        allSame = false;
        break;
      }
    }
    if (allSame) {
      return { endIndex: start + blockSize - 1, status: first };
    }
  }
  return null;
};

/**
 * Scans edges in [firstEdge, lastEdge] (1-based), counts status transitions,
 * records first two transition indices, and sums raw (unnormalized) weights for instability (Rule 7).
 */
const computeTransitionsInRange = (
  statuses: TestStatus[],
  firstEdge: number,
  lastEdge: number,
): {
  transitionCount: number;
  firstTransitionIdx: number;
  secondTransitionIdx: number;
  instabilitySumNumerator: number;
} => {
  let transitionCount = 0;
  let firstTransitionIdx = 0;
  let secondTransitionIdx = 0;
  let instabilitySumNumerator = 0;

  for (let i = firstEdge; i <= lastEdge; i++) {
    if (statuses[i - 1] === statuses[i]) {
      continue;
    }
    transitionCount++;
    if (transitionCount === 1) {
      firstTransitionIdx = i;
    } else if (transitionCount === 2) {
      secondTransitionIdx = i;
    }
    instabilitySumNumerator += i;
  }

  return { transitionCount, firstTransitionIdx, secondTransitionIdx, instabilitySumNumerator };
};

/**
 * Rule 5 & 6: true if the two transitions form P→B→P or P→F→P (tolerance pattern).
 */
const isRecoveryTolerancePattern = (
  statuses: TestStatus[],
  firstTransitionIdx: number,
  secondTransitionIdx: number,
): boolean => {
  const s0 = statuses[firstTransitionIdx - 1];
  const s1 = statuses[firstTransitionIdx];
  const s2 = statuses[secondTransitionIdx - 1];
  const s3 = statuses[secondTransitionIdx];
  return (
    (s0 === "passed" && s1 === "broken" && s2 === "broken" && s3 === "passed") ||
    (s0 === "passed" && s1 === "failed" && s2 === "failed" && s3 === "passed")
  );
};

/**
 * Computes stability score from a sequence of statuses (passed, failed, broken).
 *
 * @param statuses - Filtered status sequence (oldest to newest), length at most historyDepth
 * @param historyDepth - Max number of recent statuses to consider
 * @param stabilizationPeriod - Number of consecutive same statuses that reset the score
 * @returns Stability score in [0, 1], or undefined if effectiveSequenceLength is 0
 */
export const getStabilityScore = (
  statuses: TestStatus[],
  historyDepth: number,
  stabilizationPeriod: number,
): number | undefined => {
  const effectiveSequenceLength = Math.min(statuses.length, historyDepth);

  // Rule 1: no significant statuses → undefined
  if (effectiveSequenceLength === 0) {
    return undefined;
  }
  // Rule 2: single status → fully stable
  if (effectiveSequenceLength === 1) {
    return 1;
  }

  const stabilBlock = findLatestConsecutiveSameBlock(statuses, effectiveSequenceLength, stabilizationPeriod);

  // Rule 3: that block is at the very end and all same (passed/failed/broken) → test is stable
  if (stabilBlock !== null && stabilBlock.endIndex === effectiveSequenceLength - 1) {
    return 1;
  }

  // First edge (1-based) to consider: right after the stabil block, or 1 if no block
  const firstEdgeAfterStabilBlock = stabilBlock !== null ? stabilBlock.endIndex + 1 : 1;
  const lastEdge = effectiveSequenceLength - 1;
  const denominator = ((effectiveSequenceLength - 1) * effectiveSequenceLength) / 2;

  const { transitionCount, firstTransitionIdx, secondTransitionIdx, instabilitySumNumerator } =
    computeTransitionsInRange(statuses, firstEdgeAfterStabilBlock, lastEdge);

  // Rule 4: only one transition in range → stable
  if (transitionCount === 1) {
    return 1;
  }

  // Rule 5 & 6: two transitions P→B→P or P→F→P (tolerance) → stable
  if (transitionCount === 2 && isRecoveryTolerancePattern(statuses, firstTransitionIdx, secondTransitionIdx)) {
    return 1;
  }

  // Rule 7: weighted sum of transition contributions (more recent = higher weight), normalized by denominator
  return instabilitySumNumerator / denominator;
};

/**
 * Builds status sequence for a test from the most recent contiguous history block + current status.
 * When the test is absent in a history point, we reset and only use statuses after that gap,
 * so the sequence never has gaps between runs.
 * Only includes passed, failed, broken.
 */
const getStatusSequence = (historyDataPoints: HistoryDataPoint[], tr: TestResult): TestStatus[] => {
  let block: TestStatus[] = [];

  for (const hdp of historyDataPoints) {
    const htr = hdp.testResults[tr.historyId!];

    if (!htr) {
      // Gap: test was not in this run — keep only statuses after this point
      block = [];
      continue;
    }

    if (isSignificantStatus(htr.status)) {
      block.push(htr.status);
    }
  }

  if (isSignificantStatus(tr.status)) {
    block.push(tr.status);
  }

  return block;
};

export const generateStabilityDistributionChart = (props: {
  options: StabilityDistributionChartOptions;
  storeData: AllureChartsStoreData;
}): StabilityDistributionChartData => {
  const { options, storeData } = props;
  const {
    title,
    limit = DEFAULT_LIMIT,
    stabilizationPeriod = DEFAULT_STABILIZATION_PERIOD,
    threshold = DEFAULT_THRESHOLD,
    skipStatuses: skipStatusesList = NON_SIGNIFICANT_STATUSES,
    groupBy = DEFAULT_GROUP_BY,
    groupValues = [],
  } = options;
  const { testResults, historyDataPoints } = storeData;

  // Nst <= Nss
  const effectiveStabilizationPeriod = Math.min(stabilizationPeriod, limit);

  // Not enough history to apply stabilization rule
  if (historyDataPoints.length < effectiveStabilizationPeriod) {
    return {
      data: [],
      keys: {},
      type: ChartType.StabilityDistribution,
      title,
      threshold,
    };
  }

  const limitedHistoryDataPoints = historyDataPoints.slice(0, limit).sort((a, b) => a.timestamp - b.timestamp);

  const labelName = groupBy.startsWith(CUSTOM_LABEL_NAME_PREFIX)
    ? groupBy.slice(CUSTOM_LABEL_NAME_PREFIX.length)
    : groupBy;

  const groupValuesSet = new Set(groupValues ?? []);

  const stabilityScoresByGroup = createMapWithDefault<string, number[]>([]);
  const keys: Record<string, string> = {};
  const hashes = createHashStorage();
  const skipStatuses = new Set(skipStatusesList);

  for (const tr of testResults) {
    // no history → stability cannot be computed
    if (!tr.historyId) {
      continue;
    }

    if (!isSignificantStatus(tr.status)) {
      continue;
    }

    if (skipStatuses.has(tr.status)) {
      continue;
    }

    const labelValue = getTrLabelValue(tr, labelName);

    if (!labelValue || (groupValuesSet.size > 0 && !groupValuesSet.has(labelValue))) {
      continue;
    }

    const statusSequence = getStatusSequence(limitedHistoryDataPoints, tr);
    const stabilityScore = getStabilityScore(statusSequence, limit, effectiveStabilizationPeriod);

    if (stabilityScore === undefined) {
      continue;
    }

    const labelValueHash = hashes.get(labelValue);
    keys[labelValueHash] = labelValue;
    stabilityScoresByGroup.get(labelValueHash).push(stabilityScore);
  }

  // Average stability score per group → stability rate 0–100
  return {
    data: stabilityScoresByGroup.entries.map(([id, scores]) => {
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const stabilityRate = Math.floor(avg * 10000) / 100;
      return { id, stabilityRate };
    }),
    keys,
    type: ChartType.StabilityDistribution,
    title,
    threshold,
  };
};
