import type { TreeMapNode } from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult } from "@allurereport/core-api";

/**
 * @description Limits the history data points by a certain limit, that is necessary for charts data with a long history.
 * @param historyDataPoints - The history data points.
 * @param limit - The limit.
 * @returns The limited history data points.
 */
export const limitHistoryDataPoints = (historyDataPoints: HistoryDataPoint[], limit: number): HistoryDataPoint[] => {
  if (limit <= 0 || historyDataPoints.length === 0) {
    return [];
  }

  const clampedLimit = Math.max(0, Math.floor(limit));

  return historyDataPoints.slice(0, clampedLimit);
};

/**
 * Initializes series record with items as keys and empty arrays.
 * @param items - Items for series record.
 * @returns Record with items as keys and empty arrays.
 */
export const createEmptySeries = <T extends string>(items: readonly T[]): Record<T, string[]> =>
  items.reduce((acc, item) => ({ ...acc, [item]: [] }), {} as Record<T, string[]>);

/**
 * Initializes stats record with items as keys and 0 as values.
 * @param items - Items for stats record.
 * @returns Record with items as keys and 0 values.
 */
export const createEmptyStats = <T extends string>(items: readonly T[]): Record<T, number> =>
  items.reduce((acc, item) => ({ ...acc, [item]: 0 }), {} as Record<T, number>);

/**
 * Normalizes stats record, ensuring all items are represented.
 * @param statistic - Partial stats record.
 * @param itemType - All possible items.
 * @returns Complete stats record with all items.
 */
export const normalizeStatistic = <T extends string>(
  statistic: Partial<Record<T, number>>,
  itemType: readonly T[],
): Record<T, number> => {
  return itemType.reduce(
    (acc, item) => {
      acc[item] = statistic[item] ?? 0;
      return acc;
    },
    {} as Record<T, number>,
  );
};

/**
 * Check if test has any of the specified labels
 * Generic function that works with any label hierarchy
 */
export const hasLabels = <T extends string, TR extends TestResult | HistoryTestResult>(
  test: TR,
  labelHierarchy: T[],
): boolean =>
  test.labels?.some((label) => {
    const { name } = label;
    return name && labelHierarchy.includes(name as T);
  }) ?? false;

export const isChildrenLeavesOnly = <T extends TreeMapNode>(node: T): boolean => {
  return node.children ? node.children.every((child) => child.children === undefined) : false;
};
