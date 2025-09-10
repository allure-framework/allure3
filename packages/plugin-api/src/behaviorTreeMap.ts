import type { TestResult, TreeGroup, TreeLeaf, TreeMapNode } from "@allurereport/core-api";
import { createTreeByLabels } from "./utils/tree.js";
import { convertTreeDataToTreeMapNode, hasLabels } from "./charts.js";
import { md5 } from "./utils/misc.js";

// Behavior label types
export type BehaviorLabel = "epic" | "feature" | "story";

export type BehaviorTreeLeaf = TreeLeaf<TreeMapNode> & Pick<TestResult, "name">;
export type BehaviorTreeGroup = TreeGroup<TreeMapNode> & Pick<TestResult, "name">;

// Behavior labels array for easy checking
export const behaviorLabels: BehaviorLabel[] = ["epic", "feature", "story"];

/**
 * Create TreeMap for behavior labels with success rate metric
 * Convenient function that uses the behavior configuration
 */
export const createBehaviorTreeMap = (tests: TestResult[]): TreeMapNode => {
    const leafFactoryFn = ({ id, name, status }: TestResult): BehaviorTreeLeaf => ({
        id,
        name,
        nodeId: id,
        value: status === "passed" ? 1 : 0,
    });
    const groupFactoryFn = (parentId: string | undefined, groupClassifier: string): BehaviorTreeGroup => {
        const id = md5((parentId ? `${parentId}.` : "") + groupClassifier);

        return {
            id,
            name: groupClassifier,
            nodeId: id,
            value: 0,
        };
    };
    const addLeafToGroupFn = (group: BehaviorTreeGroup, leaf: BehaviorTreeLeaf) => {
        group.value = (group?.value ?? 0) + (leaf.value ?? 0);
    };

    const treeByLabels = createTreeByLabels<TestResult, BehaviorTreeLeaf, BehaviorTreeGroup>(
        tests,
        behaviorLabels,
        leafFactoryFn,
        groupFactoryFn,
        addLeafToGroupFn
    );

    return convertTreeDataToTreeMapNode(treeByLabels, (node) => ({
        id: node.name,
        value: node.value,
    }));
};

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
