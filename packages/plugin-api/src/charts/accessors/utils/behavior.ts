import type { TestResult, TreeGroup, TreeLeaf } from "@allurereport/core-api";
import { hasLabels } from "../../../charts.js";

// Behavior label types
export type BehaviorLabel = "epic" | "feature" | "story";

type BehaviorTreeNodeData = Pick<TestResult, "name"> & { value?: number };
export type BehaviorTreeLeaf = TreeLeaf<BehaviorTreeNodeData>;
export type BehaviorTreeGroup = TreeGroup<BehaviorTreeNodeData>;

// Behavior labels array for easy checking
export const behaviorLabels: BehaviorLabel[] = ["epic", "feature", "story"];

/**
 * Check if test has behavior labels
 * Helper function to filter tests that have behavior information
 */
export const hasBehaviorLabels = (test: TestResult): boolean => hasLabels(test, behaviorLabels);

/**
 * Filter tests that have behavior labels
 * Helper function to get only tests with behavior information
 */
export const filterTestsWithBehaviorLabels = (tests: TestResult[]): TestResult[] => tests.filter(hasBehaviorLabels);
