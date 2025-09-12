import type { TestResult, TreeGroup, TreeLeaf, TreeMapNode } from "@allurereport/core-api";
import { createTreeByLabels } from "../utils/tree.js";
import { convertTreeDataToTreeMapNode, hasLabels, transformTreeMapNode } from "../charts.js";
import { md5 } from "../utils/misc.js";

// Behavior label types
export type BehaviorLabel = "epic" | "feature" | "story";

type BehaviorTreeNodeData = Pick<TestResult, "name"> & { value?: number };
export type BehaviorTreeLeaf = TreeLeaf<BehaviorTreeNodeData>;
export type BehaviorTreeGroup = TreeGroup<BehaviorTreeNodeData>;

// Behavior labels array for easy checking
export const behaviorLabels: BehaviorLabel[] = ["epic", "feature", "story"];

/**
 * Create TreeMap for behavior labels with success rate metric
 * Convenient function that uses the behavior configuration
 */
export const createBehaviorTreeMap = (tests: TestResult[]): TreeMapNode => {
    const leafFactoryFn = ({ id, name, status }: TestResult): BehaviorTreeLeaf => ({
        nodeId: id,
        name,
        value: status === "passed" ? 1 : 0,
    });
    const groupFactoryFn = (parentId: string | undefined, groupClassifier: string): BehaviorTreeGroup => ({
        nodeId:  md5((parentId ? `${parentId}.` : "") + groupClassifier),
        name: groupClassifier,
        value: 0,
    });
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

    const convertedTree = convertTreeDataToTreeMapNode(treeByLabels, (node, isGroup) => ({
        id: node.name,
        value: isGroup ? undefined : node.value, // Only leaves have value (nivo tree map for some reason requires value for group to be omited for correct visualization)
    }));

    // To calculate colorValue for node we need to rely on its recursive subtree metrics calculations
    const calculateSubtreeMetrics = (node: TreeMapNode): { totalTests: number; passedTests: number } => {
        if (!node.children || node.children.length === 0) {
            // Leaf node - value represents passed tests (1 for passed, 0 for failed)
            return { totalTests: 1, passedTests: node.value ?? 0 };
        }

        // Group node - aggregate metrics from children
        let totalTests = 0;
        let passedTests = 0;

        for (const child of node.children) {
            const childMetrics = calculateSubtreeMetrics(child);
            totalTests += childMetrics.totalTests;
            passedTests += childMetrics.passedTests;
        }

        return { totalTests, passedTests };
    };

    transformTreeMapNode<TreeMapNode & { colorValue?: number }>(convertedTree, (node) => {
        const { totalTests, passedTests } = calculateSubtreeMetrics(node);
        const colorValue = totalTests > 0 ? passedTests / totalTests : 0;

        // Add colorValue to the node
        node.colorValue = colorValue;
    });

    return convertedTree;
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
