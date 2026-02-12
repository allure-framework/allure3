import type { TreeMapDataAccessor, TreeMapNode } from "@allurereport/charts-api";
import type { TestResult, TreeGroup, TreeLeaf } from "@allurereport/core-api";
import { createTreeByLabels, md5 } from "@allurereport/plugin-api";
import { isChildrenLeavesOnly } from "../chart-utils.js";
import { convertTreeDataToTreeMapNode, transformTreeMapNode } from "../treeMap.js";
import { behaviorLabels, filterTestsWithBehaviorLabels } from "./utils/behavior.js";

type SubtreeMetrics = {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  otherTests: number;
};
type LeafMetrics = Pick<TestResult, "status">;
type GroupMetrics = Omit<SubtreeMetrics, "totalTests">;

type BaseData = Pick<TestResult, "name"> & {
  value: number;
};
type LeafData = BaseData & LeafMetrics;
type GroupData = BaseData & GroupMetrics;

type Leaf = TreeLeaf<LeafData>;
type Group = TreeGroup<GroupData>;

// Represents both Group and Leaf conversion to TreeMapNode-compatible structure
type ExtendedTreeMapNode = TreeMapNode<GroupMetrics & Partial<LeafMetrics>>;

const leafFactoryFn = ({ id, name, status }: TestResult): Leaf => ({
  nodeId: id,
  name,
  status,
  value: 1, // default number of tests in the leaf
});
const groupFactoryFn = (parentId: string | undefined, groupClassifier: string): Group => ({
  nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
  name: groupClassifier,
  value: 0, // default number of tests in the group
  passedTests: 0,
  failedTests: 0,
  otherTests: 0,
});
const addLeafToGroupFn = (group: Group, leaf: Leaf): void => {
  group.value += leaf.value;

  group.passedTests += leaf.status === "passed" ? 1 : 0;
  group.failedTests += leaf.status === "failed" ? 1 : 0;
  group.otherTests += leaf?.status && !["passed", "failed"].includes(leaf.status) ? 1 : 0;
};

const calculateColorValue = ({ totalTests, passedTests }: SubtreeMetrics): number => {
  return totalTests > 0 ? passedTests / totalTests : 0;
};

// To calculate colorValue for node we need to rely on its recursive subtree metrics calculations
const calculateSubtreeMetrics = (node: ExtendedTreeMapNode): SubtreeMetrics => {
  if (!node.children || node.children.length === 0) {
    // Leaf node - value represents passed tests (1 for passed, 0 for failed)
    return {
      totalTests: 1,
      passedTests: node?.status === "passed" ? 1 : 0,
      failedTests: node?.status === "failed" ? 1 : 0,
      otherTests: node?.status && !["passed", "failed"].includes(node.status) ? 1 : 0,
    };
  }

  // Group node - aggregate metrics from children
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let otherTests = 0;

  for (const child of node.children) {
    const childMetrics = calculateSubtreeMetrics(child);
    totalTests += childMetrics.totalTests;
    passedTests += childMetrics.passedTests;
    failedTests += childMetrics.failedTests;
    otherTests += childMetrics.otherTests;
  }

  return { totalTests, passedTests, failedTests, otherTests };
};

/**
 * Create TreeMap for behavior labels with success rate metric
 * Convenient function that uses the behavior configuration
 */
export const createSuccessRateDistributionTreeMap = (testResults: TestResult[]): ExtendedTreeMapNode => {
  const treeByLabels = createTreeByLabels<TestResult, Leaf, Group>(
    testResults,
    behaviorLabels,
    leafFactoryFn,
    groupFactoryFn,
    addLeafToGroupFn,
  );

  const convertedTree = convertTreeDataToTreeMapNode<ExtendedTreeMapNode, LeafData, GroupData>(
    treeByLabels,
    (node, isGroup) => {
      const baseNode = {
        id: node.name,
        value: isGroup ? undefined : node.value,
      };

      if (isGroup) {
        const group = node as Group;
        return {
          ...baseNode,
          passedTests: group.passedTests,
          failedTests: group.failedTests,
          otherTests: group.otherTests,
        };
      } else {
        const leaf = node as Leaf;
        return {
          ...baseNode,
          status: leaf.status,
          passedTests: leaf?.status === "passed" ? 1 : 0,
          failedTests: leaf?.status === "failed" ? 1 : 0,
          otherTests: leaf?.status && !["passed", "failed"].includes(leaf.status) ? 1 : 0,
        };
      }
    },
    () => ({
      id: "root",
      passedTests: 0,
      failedTests: 0,
      otherTests: 0,
    }),
  );

  return transformTreeMapNode<ExtendedTreeMapNode>(convertedTree, (node) => {
    const subtreeMetrics = calculateSubtreeMetrics(node);
    const colorValue = calculateColorValue(subtreeMetrics);
    const { totalTests, ...restSubtreeMetrics } = subtreeMetrics;

    // Add colorValue and remove leafs in favour of their parent group nodes
    if (isChildrenLeavesOnly(node)) {
      const value = node.children?.reduce((acc, child) => {
        return acc + (child.value ?? 0);
      }, 0);

      return {
        ...node,
        value,
        children: undefined,
        colorValue,
        ...restSubtreeMetrics,
      };
    }

    return {
      ...node,
      colorValue,
      ...restSubtreeMetrics,
    };
  });
};

export const successRateDistributionTreeMapAccessor: TreeMapDataAccessor<ExtendedTreeMapNode> = {
  getTreeMap: ({ testResults }) => {
    const testsWithBehaviorLabels = filterTestsWithBehaviorLabels(testResults);

    return createSuccessRateDistributionTreeMap(testsWithBehaviorLabels);
  },
};
