import type { TestResult, TreeGroup, TreeLeaf, TreeMapNode } from "@allurereport/core-api";
import { createTreeByLabels } from "./utils/tree.js";
import { convertTreeDataToTreeMapNode, hasLabels, transformTreeMapNode } from "./charts.js";
import { md5 } from "./utils/misc.js";

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

    const convertedTree = convertTreeDataToTreeMapNode(treeByLabels, (node, isGroup) => {
        // console.log("%c##### convertTreeDataToTreeMapNode: node #####", "color: salmon", {node, isGroup});

        return ({
            id: node.name,
            value: node.value,
        });
    });

    // console.log("\n\n#############");
    /* transformTreeMapNode<TreeMapNode>(convertedTree, (node) => {
        console.log("%c##### transformTreeMapNode: node #####", "color: orangered", node);
    });*/

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
