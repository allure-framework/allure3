import type { HistoryTestResult, TestResult } from "@allurereport/core-api";
import { hasLabels } from "../../chart-utils.js";

// Behavior label types
export type BehaviorLabel = "epic" | "feature" | "story";

// Behavior labels array for easy checking
export const behaviorLabels: BehaviorLabel[] = ["epic", "feature", "story"];

/**
 * Check if test has behavior labels
 * Helper function to filter tests that have behavior information
 */
export const hasBehaviorLabels = <T extends TestResult | HistoryTestResult>(test: T): boolean =>
  hasLabels(test, behaviorLabels);

/**
 * Filter tests that have behavior labels
 * Helper function to get only tests with behavior information
 */
export const filterTestsWithBehaviorLabels = <T extends TestResult | HistoryTestResult>(tests: T[]): T[] =>
  tests.filter(hasBehaviorLabels);
