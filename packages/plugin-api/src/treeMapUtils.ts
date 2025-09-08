import type { TestResult, TreeMapNode } from "@allurereport/core-api";

// Generic label path - works with any label hierarchy
export type LabelPath<T extends string> = {
  [K in T]?: string;
};

// Abstract metric calculator object with functions
export interface TreeMapMetric<T extends string> {
  calculate: (tests: TestResult[], path: LabelPath<T>) => number;
  getDisplayName: (path: LabelPath<T>) => string;
}

// Configuration for any label-based TreeMap
export interface TreeMapConfig<T extends string> {
  rootId: string;
  rootName: string;
  labelHierarchy: T[];
  metricCalculator: TreeMapMetric<T>;
  nodeSorter?: (a: TreeMapNode, b: TreeMapNode) => number;
}

// Function type for TreeMap builder
export type TreeMapBuilder = (tests: TestResult[]) => TreeMapNode;

/**
 * Extract label path from test using configurable hierarchy
 * Single pass through labels for optimal performance
 */
export const extractLabelPath = <T extends string>(
  test: TestResult,
  labelHierarchy: T[],
): LabelPath<T> => {
  const path: LabelPath<T> = {};

  test.labels.forEach(label => {
    const { name, value } = label;
    if (name && value && labelHierarchy.includes(name as T)) {
      path[name as T] = value;
    }
  });

  return path;
};

/**
 * Check if test has any of the specified labels
 * Generic function that works with any label hierarchy
 */
export const hasLabels = <T extends string>(
  test: TestResult,
  labelHierarchy: T[],
): boolean => {
  return test.labels.some(label => {
    const { name } = label;
    return name && labelHierarchy.includes(name as T);
  });
};

/**
 * Group tests by label path using Map for O(1) access
 * Single pass through tests for optimal performance
 */
export const groupByLabelPath = <T extends string>(
  tests: TestResult[],
  labelHierarchy: T[],
): Map<string, TestResult[]> => {
  const groups = new Map<string, TestResult[]>();

  tests.forEach(test => {
    const path = extractLabelPath(test, labelHierarchy);
    const pathKey = createPathKey(path);

    if (!groups.has(pathKey)) {
      groups.set(pathKey, []);
    }

    groups.get(pathKey)!.push(test);
  });

  return groups;
};

/**
 * Create unique key from label path
 * Used for grouping tests by their label hierarchy
 */
const createPathKey = <T extends string>(path: LabelPath<T>): string => {
  const pathEntries = Object.entries(path)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}:${value as string}`);

  return pathEntries.join("|") || "empty";
};

/**
 * Calculate metric value for a group of tests
 */
export const calculateMetric = <T extends string>(
  tests: TestResult[],
  path: LabelPath<T>,
  metric: TreeMapMetric<T>,
): number => {
  return metric.calculate(tests, path);
};

/**
 * Build TreeMap node with configurable metric
 */
export const buildTreeMapNode = <T extends string>(
  id: string,
  name: string,
  tests: TestResult[],
  path: LabelPath<T>,
  metric: TreeMapMetric<T>,
): TreeMapNode => {
  const value = calculateMetric(tests, path, metric);

  return {
    id,
    value,
    children: [], // Will be populated by parent function
  };
};

/**
 * Main function to create TreeMap from config
 */
export const createTreeMap = <T extends string>(
  tests: TestResult[],
  config: TreeMapConfig<T>,
): TreeMapNode => {
  const { rootId, labelHierarchy, metricCalculator, nodeSorter } = config;

  // Group tests by label path
  const groups = groupByLabelPath(tests, labelHierarchy);

  // Build child nodes
  const childNodes = Array.from(groups.entries()).map(([pathKey, groupTests]) => {
    const path = parsePathKey<T>(pathKey, labelHierarchy);
    const displayName = metricCalculator.getDisplayName(path);
    const nodeId = `${rootId}-${pathKey}`;

    return buildTreeMapNode(nodeId, displayName, groupTests, path, metricCalculator);
  });

  // Sort nodes if sorter provided
  const sortedChildNodes = nodeSorter ? childNodes.sort(nodeSorter) : childNodes;

  // Build root node
  const rootValue = calculateMetric(tests, {}, metricCalculator);
  return {
    id: rootId,
    value: rootValue,
    children: sortedChildNodes,
  };
};

/**
 * Parse path key back to label path object
 */
const parsePathKey = <T extends string>(
  pathKey: string,
  labelHierarchy: T[],
): LabelPath<T> => {
  if (pathKey === "empty") {
    return {};
  }

  const pathParts = pathKey.split("|");
  return pathParts.reduce((path, part) => {
    const [key, value] = part.split(":");
    if (key && value && labelHierarchy.includes(key as T)) {
      path[key as T] = value;
    }
    return path;
  }, {} as LabelPath<T>);
};

/**
 * Factory function to create TreeMap builder
 */
export const createTreeMapBuilder = <T extends string>(
  config: TreeMapConfig<T>,
): TreeMapBuilder => {
  return (tests: TestResult[]) => createTreeMap(tests, config);
};
