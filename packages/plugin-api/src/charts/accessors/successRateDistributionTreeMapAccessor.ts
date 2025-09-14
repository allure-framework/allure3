import type { TreeMapDataAccessor } from "../../charts.js";
import type { TestResult, TreeMapNode } from "@allurereport/core-api";
import type { BehaviorTreeGroup, BehaviorTreeLeaf } from "./utils/behavior.js";
import { behaviorLabels, filterTestsWithBehaviorLabels } from "./utils/behavior.js";
import { md5 } from "../../utils/misc.js";
import { createTreeByLabels } from "../../utils/tree.js";
import { convertTreeDataToTreeMapNode, transformTreeMapNode } from "../treeMap.js";

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

const calculateColorValue = ({ totalTests, passedTests }: { totalTests: number; passedTests: number }): number => {
  return totalTests > 0 ? passedTests / totalTests : 0;
};

const isLeafsPredecessor = (node: TreeMapNode): boolean => {
  return node.children ? node.children.every((child) => child.value !== undefined) : false;
};

const elevateLeafsData = (node: TreeMapNode): TreeMapNode => {
  const value = node.children?.reduce((acc, child) => {
    return acc + (child.value ?? 0);
  }, 0);

  return {
      ...node,
      value,
      children: undefined
  };
};

/**
* Create TreeMap for behavior labels with success rate metric
* Convenient function that uses the behavior configuration
*/
export const createBehaviorTreeMap = (testResults: TestResult[]): TreeMapNode => {
  const treeByLabels = createTreeByLabels<TestResult, BehaviorTreeLeaf, BehaviorTreeGroup>(
      testResults,
      behaviorLabels,
      leafFactoryFn,
      groupFactoryFn,
      addLeafToGroupFn
  );

  const convertedTree = convertTreeDataToTreeMapNode(treeByLabels, (node, _, isGroup) => ({
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

  return transformTreeMapNode(convertedTree, (node) => {
      const subtreeMetrics = calculateSubtreeMetrics(node);
      const colorValue = calculateColorValue(subtreeMetrics);

      // Add colorValue and remove leafs in favour of their parent group nodes
      if (isLeafsPredecessor(node)) {
          return {
            ...elevateLeafsData(node),
            colorValue,
          };
      }

      return {
          ...node,
          colorValue,
      };
  });
};

export const successRateDistributionTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: ({ testResults }) => {
    const testsWithBehaviorLabels = filterTestsWithBehaviorLabels(testResults);

    return createBehaviorTreeMap(testsWithBehaviorLabels);
  },
};
