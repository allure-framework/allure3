import type { TreeMapDataAccessor, TreeMapNode } from "@allurereport/charts-api";
import type { HistoryTestResult, TestResult, TreeGroup, TreeLeaf } from "@allurereport/core-api";
import { createTreeByLabels, md5 } from "@allurereport/plugin-api";
import { isChildrenLeavesOnly } from "../chart-utils.js";
import { convertTreeDataToTreeMapNode, transformTreeMapNode } from "../treeMap.js";
import { behaviorLabels, filterTestsWithBehaviorLabels } from "./utils/behavior.js";

type ChangeType = "new" | "deleted" | "enabled" | "disabled" | "unchanged";

type SubtreeMetrics = {
  totalTests: number;
  newCount: number;
  deletedCount: number;
  disabledCount: number;
  enabledCount: number;
};
type LeafMetrics = {
  changeType: ChangeType;
};
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

const groupFactoryFn = (parentId: string | undefined, groupClassifier: string): Group => ({
  nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
  name: groupClassifier,
  value: 0,
  newCount: 0,
  deletedCount: 0,
  disabledCount: 0,
  enabledCount: 0,
});

const addLeafToGroupFn = (group: Group, leaf: Leaf): void => {
  group.value += leaf.value;

  switch (leaf.changeType) {
    case "new":
      group.newCount++;
      break;
    case "deleted":
      group.deletedCount++;
      break;
    case "enabled":
      group.enabledCount++;
      break;
    case "disabled":
      group.disabledCount++;
      break;
  }
};

const calculateColorValue = (metrics: SubtreeMetrics): number => {
  const netChange = metrics.newCount + metrics.enabledCount - (metrics.deletedCount + metrics.disabledCount);
  const normalizedChange = netChange / metrics.totalTests;

  // Normalize to 0-1 range from -1 to 1
  return Math.max(0, Math.min(1, (normalizedChange + 1) / 2));
};

const isSkipped = (tr: TestResult | HistoryTestResult): boolean => tr.status === "skipped";

const getNewTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => !closestHtrs[tr.historyId!]);
};

const getRemovedTestResults = (
  trs: TestResult[],
  closestHtrs: Record<string, HistoryTestResult>,
): HistoryTestResult[] => {
  const historyPointTestResultsAsArray = Object.values(closestHtrs);
  const testResultsAsDictionary: Record<string, TestResult> = Object.fromEntries(trs.map((tr) => [tr.historyId, tr]));

  return historyPointTestResultsAsArray.filter((htr) => !testResultsAsDictionary[htr.historyId!]);
};

const getEnabledTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => {
    const historyPointTestResult: HistoryTestResult | undefined = closestHtrs[tr.historyId!];

    return historyPointTestResult && isSkipped(historyPointTestResult) && !isSkipped(tr);
  });
};

const getDisabledTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => {
    const historyPointTestResult: HistoryTestResult | undefined = closestHtrs[tr.historyId!];

    return historyPointTestResult && !isSkipped(historyPointTestResult) && isSkipped(tr);
  });
};

const calculateSubtreeMetrics = (node: ExtendedTreeMapNode): SubtreeMetrics => {
  if (!node.children || node.children.length === 0) {
    // Leaf node
    const changeType = node?.changeType;

    return {
      totalTests: 1,
      newCount: changeType === "new" ? 1 : 0,
      deletedCount: changeType === "deleted" ? 1 : 0,
      disabledCount: changeType === "disabled" ? 1 : 0,
      enabledCount: changeType === "enabled" ? 1 : 0,
    };
  }

  // Group node
  let totalTests = 0;
  let newCount = 0;
  let deletedCount = 0;
  let disabledCount = 0;
  let enabledCount = 0;

  for (const child of node.children) {
    const childMetrics = calculateSubtreeMetrics(child);
    totalTests += childMetrics.totalTests;
    newCount += childMetrics.newCount;
    deletedCount += childMetrics.deletedCount;
    disabledCount += childMetrics.disabledCount;
    enabledCount += childMetrics.enabledCount;
  }

  return { totalTests, newCount, deletedCount, disabledCount, enabledCount };
};

const createCoverageDiffTreeMap = (
  trs: TestResult[],
  closestHtrs: Record<string, HistoryTestResult>,
): ExtendedTreeMapNode => {
  const newTrs = getNewTestResults(trs, closestHtrs);
  const removedHtrs = getRemovedTestResults(trs, closestHtrs);
  const enabledTrs = getEnabledTestResults(trs, closestHtrs);
  const disabledTrs = getDisabledTestResults(trs, closestHtrs);

  const newTestsById = new Map(newTrs.map((tr) => [tr.historyId, tr]));
  const deletedTestsById = new Map(removedHtrs.map((htr) => [htr.historyId, htr]));
  const enabledTestsById = new Map(enabledTrs.map((tr) => [tr.historyId, tr]));
  const disabledTestsById = new Map(disabledTrs.map((tr) => [tr.historyId, tr]));

  // Including into future tree current tests + removed historical tests to be able to reflect removed historical tests
  const allTests: (TestResult | HistoryTestResult)[] = [...trs, ...removedHtrs];

  const getChangeType = (historyId?: string): ChangeType => {
    if (newTestsById.has(historyId)) {
      return "new";
    }
    if (deletedTestsById.has(historyId)) {
      return "deleted";
    }
    if (enabledTestsById.has(historyId)) {
      return "enabled";
    }
    if (disabledTestsById.has(historyId)) {
      return "disabled";
    }

    return "unchanged";
  };

  const leafFactoryFnWithMaps = (test: TestResult | HistoryTestResult): Leaf => {
    const changeType = getChangeType(test.historyId);

    return {
      nodeId: test.id,
      name: test.name,
      value: 1, // Default number of tests in the leaf
      changeType,
    };
  };

  const treeByLabels = createTreeByLabels<TestResult | HistoryTestResult, Leaf, Group>(
    allTests,
    behaviorLabels,
    leafFactoryFnWithMaps,
    groupFactoryFn,
    addLeafToGroupFn,
  );

  const convertedTree = convertTreeDataToTreeMapNode<ExtendedTreeMapNode, LeafData, GroupData>(
    treeByLabels,
    (node, isGroup) => {
      const baseNode = {
        id: node.name,
        /**
         * Make sure in node.value will be 1 no matter what.
         * This is responsible for the test visibility in mixed groups and it will affect parent value calculation in the tree map chart (nivo only)
         */
        value: isGroup ? undefined : node.value,
      };

      if (isGroup) {
        const group = node as Group;
        return {
          ...baseNode,
          newCount: group.newCount,
          deletedCount: group.deletedCount,
          disabledCount: group.disabledCount,
          enabledCount: group.enabledCount,
        };
      } else {
        const leaf = node as Leaf;
        return {
          ...baseNode,
          changeType: leaf.changeType,
          newCount: leaf.changeType === "new" ? 1 : 0,
          deletedCount: leaf.changeType === "deleted" ? 1 : 0,
          disabledCount: leaf.changeType === "disabled" ? 1 : 0,
          enabledCount: leaf.changeType === "enabled" ? 1 : 0,
        };
      }
    },
    () => ({
      id: "root",
      newCount: 0,
      deletedCount: 0,
      disabledCount: 0,
      enabledCount: 0,
    }),
  );

  return transformTreeMapNode<ExtendedTreeMapNode>(convertedTree, (node) => {
    const subtreeMetrics = calculateSubtreeMetrics(node);
    const colorValue = calculateColorValue(subtreeMetrics);
    const { totalTests, ...restSubtreeMetrics } = subtreeMetrics;

    if (isChildrenLeavesOnly(node)) {
      return {
        ...node,
        value: totalTests,
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

export const coverageDiffTreeMapAccessor: TreeMapDataAccessor<ExtendedTreeMapNode> = {
  getTreeMap: ({ testResults, historyDataPoints }) => {
    const testsWithBehaviorLabels = filterTestsWithBehaviorLabels(testResults);
    const closestHdp = historyDataPoints[0];
    const closestHtrs = closestHdp.testResults;
    const closestHtrsWithBehaviorLabels = filterTestsWithBehaviorLabels(Object.values(closestHtrs));
    const closestHtrsWithBehaviorLabelsById = Object.fromEntries(
      closestHtrsWithBehaviorLabels.map((htr) => [htr.historyId, htr]),
    );

    return createCoverageDiffTreeMap(testsWithBehaviorLabels, closestHtrsWithBehaviorLabelsById);
  },
};
