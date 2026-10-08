import type { HistoryDataPoint, HistoryTestResult } from "../history.js";
import type { TestResult } from "../model.js";
import { DEFAULT_ENVIRONMENT } from "./environment.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeHistoryTestResults = (testResults: unknown): Record<string, HistoryTestResult> => {
  if (!isRecord(testResults)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(testResults).flatMap(([retryHash, value]) => {
      if (!isRecord(value)) {
        return [];
      }

      const historyTestResult = { ...value };

      delete historyTestResult.historyId;

      return [
        [
          retryHash,
          {
            ...historyTestResult,
            retryHash,
          },
        ],
      ];
    }),
  ) as Record<string, HistoryTestResult>;
};

const normalizeHistoryMetrics = (metrics: unknown): Record<string, number> => {
  if (!isRecord(metrics)) {
    return {};
  }

  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => Number.isFinite(value))) as Record<
    string,
    number
  >;
};

const isDefaultEnvironment = (result: TestResult | HistoryTestResult): boolean =>
  result.environment === undefined || result.environment === DEFAULT_ENVIRONMENT;

/**
 * Selects canonical history first in each point without modifying historical data.
 * Supply all current results, including retries, so conflicting legacy claims are
 * rejected even when a consumer later filters by category or environment.
 *
 * @deprecated Only the explicit legacy-ID fallback is temporary compatibility
 * for https://github.com/allure-framework/allure3/pull/903.
 */
export const createHistoryTestResultLookup = (testResults: Iterable<TestResult | HistoryTestResult>) => {
  const canonicalKeys = new Set<string>();
  const retryHashByLegacyHistoryId = new Map<string, string | undefined>();

  for (const result of testResults) {
    if (!result.retryHash) {
      continue;
    }

    canonicalKeys.add(result.retryHash);

    const legacyId = "sourceMetadata" in result ? result.sourceMetadata?.legacyHistoryId : undefined;

    if (!legacyId || !isDefaultEnvironment(result) || ("environmentHash" in result && result.environmentHash)) {
      continue;
    }

    if (!retryHashByLegacyHistoryId.has(legacyId)) {
      retryHashByLegacyHistoryId.set(legacyId, result.retryHash);
    } else if (retryHashByLegacyHistoryId.get(legacyId) !== result.retryHash) {
      retryHashByLegacyHistoryId.set(legacyId, undefined);
    }
  }

  for (const [legacyId, retryHash] of retryHashByLegacyHistoryId) {
    if (retryHash === undefined || (canonicalKeys.has(legacyId) && legacyId !== retryHash)) {
      retryHashByLegacyHistoryId.set(legacyId, undefined);
    }
  }

  // Charts also compare two historical records. Resolve their keys only through
  // an explicit, unambiguous alias supplied by a current result.
  const legacyByCanonical = new Map<string, string | undefined>();

  for (const [legacyId, retryHash] of retryHashByLegacyHistoryId) {
    if (!retryHash || legacyId === retryHash) {
      continue;
    }

    legacyByCanonical.set(retryHash, legacyByCanonical.has(retryHash) ? undefined : legacyId);
  }

  return <T extends TestResult | HistoryTestResult>(
    point: { testResults?: Record<string, T> },
    result: TestResult | HistoryTestResult,
  ): T | undefined => {
    if (!result.retryHash) {
      return undefined;
    }

    const historicalDefault = !("sourceMetadata" in result) && isDefaultEnvironment(result);
    const retryHash = historicalDefault
      ? (retryHashByLegacyHistoryId.get(result.retryHash) ?? result.retryHash)
      : result.retryHash;
    const canonical = Object.hasOwn(point.testResults ?? {}, retryHash) ? point.testResults?.[retryHash] : undefined;

    if (canonical) {
      return canonical;
    }

    const legacyId =
      "sourceMetadata" in result
        ? result.sourceMetadata?.legacyHistoryId
        : historicalDefault
          ? legacyByCanonical.get(retryHash)
          : undefined;

    if (
      !legacyId ||
      retryHashByLegacyHistoryId.get(legacyId) !== retryHash ||
      !isDefaultEnvironment(result) ||
      ("environmentHash" in result && result.environmentHash)
    ) {
      return undefined;
    }

    const legacy = Object.hasOwn(point.testResults ?? {}, legacyId) ? point.testResults?.[legacyId] : undefined;

    return legacy && isDefaultEnvironment(legacy) ? legacy : undefined;
  };
};

export const normalizeHistoryDataPoint = (historyDataPoint: HistoryDataPoint): HistoryDataPoint => ({
  ...historyDataPoint,
  knownTestCaseIds: Array.isArray(historyDataPoint.knownTestCaseIds) ? historyDataPoint.knownTestCaseIds : [],
  testResults: normalizeHistoryTestResults(historyDataPoint.testResults),
  metrics: normalizeHistoryMetrics(historyDataPoint.metrics),
  url: historyDataPoint.url ?? "",
});

export const normalizeHistoryDataPointUrls = (historyDataPoint: HistoryDataPoint): HistoryDataPoint => {
  const normalizedHistoryDataPoint = normalizeHistoryDataPoint(historyDataPoint);
  const { url } = normalizedHistoryDataPoint;

  if (!url) {
    return normalizedHistoryDataPoint;
  }

  let testResults = normalizedHistoryDataPoint.testResults;

  for (const [retryHash, historyTestResult] of Object.entries(normalizedHistoryDataPoint.testResults)) {
    if (historyTestResult.url) {
      continue;
    }

    if (testResults === normalizedHistoryDataPoint.testResults) {
      testResults = { ...normalizedHistoryDataPoint.testResults };
    }

    testResults[retryHash] = {
      ...historyTestResult,
      url,
    };
  }

  if (testResults === normalizedHistoryDataPoint.testResults) {
    return normalizedHistoryDataPoint;
  }

  return {
    ...normalizedHistoryDataPoint,
    testResults,
  };
};

export const selectHistoryTestResults = (
  historyDataPoints: HistoryDataPoint[],
  retryHashes: readonly string[],
): HistoryTestResult[] => {
  if (retryHashes.length === 0) {
    return [];
  }

  return historyDataPoints.reduce((acc, historyDataPoint) => {
    for (const retryHash of retryHashes) {
      const historyTestResult = historyDataPoint.testResults?.[retryHash];

      if (!historyTestResult) {
        continue;
      }

      acc.push(historyTestResult);
      break;
    }

    return acc;
  }, [] as HistoryTestResult[]);
};

/**
 * @description Gets the historical test results for the test result.
 * @param hdps - The history data points.
 * @param tr - The test result or history test result.
 * @returns The history test results array.
 */
export const htrsByTr = (hdps: HistoryDataPoint[], tr: TestResult | HistoryTestResult): HistoryTestResult[] => {
  const lookup = createHistoryTestResultLookup([tr]);

  return hdps.flatMap((point) => {
    const result = lookup(point, tr);

    return result ? [result] : [];
  });
};
