import type { TestResult, TreeMapNode } from "@allurereport/core-api";
import type { LabelPath, TreeMapConfig, TreeMapMetric } from "./treeMapUtils.js";
import { createTreeMap, extractLabelPath, hasLabels } from "./treeMapUtils.js";

// Behavior label types
export type BehaviorLabel = "epic" | "feature" | "story";

// Behavior labels array for easy checking
export const behaviorLabels: BehaviorLabel[] = ["epic", "feature", "story"];

// Behavior label path type
export type BehaviorPath = LabelPath<BehaviorLabel>;

/**
 * Success rate metric calculator for behavior labels
 * Calculates percentage of passed tests in a group
 */
export const successRateMetric: TreeMapMetric<BehaviorLabel> = {
  calculate: (tests: TestResult[]): number => {
    const totalTests = tests.length;
    if (totalTests === 0) {
      return 0;
    }

    const passedTests = tests.filter(test => test.status === "passed").length;
    return Math.round((passedTests / totalTests) * 100);
  },

  getDisplayName: (path: BehaviorPath): string => {
    const pathParts = behaviorLabels
      .map((label: BehaviorLabel) => path[label])
      .filter(Boolean);

    return pathParts.join(" > ") || "Unknown";
  },
};

/**
 * Configuration for behavior labels TreeMap
 * Uses epic -> feature -> story hierarchy with success rate metric
 */
export const behaviorLabelConfig: TreeMapConfig<BehaviorLabel> = {
  rootId: "successRateDistribution",
  rootName: "Success Rate Distribution",
  labelHierarchy: ["epic", "feature", "story"],
  metricCalculator: successRateMetric,
  nodeSorter: (a: TreeMapNode, b: TreeMapNode) => (b.value || 0) - (a.value || 0),
};

/**
 * Create TreeMap for behavior labels with success rate metric
 * Convenient function that uses the behavior configuration
 */
export const createBehaviorTreeMap = (tests: TestResult[]): TreeMapNode => {
  return createTreeMap(tests, behaviorLabelConfig);
};

/**
 * Extract behavior path from test result
 * Helper function for getting behavior hierarchy from a single test
 */
export const extractBehaviorPath = (test: TestResult): BehaviorPath => {
  return extractLabelPath(test, behaviorLabels);
};

/**
 * Check if test has behavior labels
 * Helper function to filter tests that have behavior information
 */
export const hasBehaviorLabels = (test: TestResult): boolean => {
  return hasLabels(test, behaviorLabels);
};

/**
 * Filter tests that have behavior labels
 * Helper function to get only tests with behavior information
 */
export const filterTestsWithBehaviorLabels = (tests: TestResult[]): TestResult[] => {
  return tests.filter(hasBehaviorLabels);
};
