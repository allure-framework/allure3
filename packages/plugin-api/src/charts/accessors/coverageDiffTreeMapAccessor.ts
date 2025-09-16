import type { TreeMapDataAccessor } from "../../charts.js";
import { isChildrenLeavesOnly } from "../../charts.js";
import type { TreeMapNode, TestResult, HistoryTestResult, TreeLeaf, TreeGroup } from "@allurereport/core-api";
import { behaviorLabels, filterTestsWithBehaviorLabels } from "./utils/behavior.js";
import { md5 } from "../../utils/misc.js";
import { createTreeByLabels } from "../../utils/tree.js";
import { convertTreeDataToTreeMapNode, transformTreeMapNode } from "../treeMap.js";

type SubtreeMetrics = {
  totalTests: number;
  newCount: number;
  deletedCount: number;
  disabledCount: number;
  enabledCount: number;
};

type LeafData = Pick<TestResult, "name"> & {
  value: number; // number of tests in the leaf
  changeType: "new" | "deleted" | "enabled" | "disabled" | "unchanged";
};
type GroupData = Pick<TestResult, "name"> & {
  value: number; // net change in number of tests for the group (diff between new + enabled and deleted + disabled tests)
  newCount: number;
  deletedCount: number;
  disabledCount: number;
  enabledCount: number;
  colorValue?: number;
};

type Leaf = TreeLeaf<LeafData>;
type Group = TreeGroup<GroupData>;

// Represents both Group and Leaf conversion to TreeMapNode-compatible structure
type ExtendedTreeMapNode = TreeMapNode<{
  changeType?: "new" | "deleted" | "enabled" | "disabled" | "unchanged";
  newCount?: number;
  deletedCount?: number;
  disabledCount?: number;
  enabledCount?: number;
}>;

const groupFactoryFn = (parentId: string | undefined, groupClassifier: string): Group => ({
  nodeId: md5((parentId ? `${parentId}.` : "") + groupClassifier),
  name: groupClassifier,
  value: 0,
  newCount: 0,
  deletedCount: 0,
  disabledCount: 0,
  enabledCount: 0,
});

const addLeafToGroupFn = (group: Group, leaf: Leaf) => {
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
  const netChange = (metrics.newCount + metrics.enabledCount) - (metrics.deletedCount + metrics.disabledCount);
  const normalizedChange = netChange / metrics.totalTests;

  // Normalize to 0-1 range from -1 to 1
  return Math.max(0, Math.min(1, (normalizedChange + 1) / 2));
};

const isSkipped = (tr: TestResult | HistoryTestResult): boolean => tr.status === "skipped";

const getNewTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => !closestHtrs[tr.historyId!]);
};

const getRemovedTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): HistoryTestResult[] => {
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

const createCoverageDiffTreeMap = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TreeMapNode => {
  const newTrs = getNewTestResults(trs, closestHtrs);
  const removedHtrs = getRemovedTestResults(trs, closestHtrs);
  const enabledTrs = getEnabledTestResults(trs, closestHtrs);
  const disabledTrs = getDisabledTestResults(trs, closestHtrs);

  const newTestsById = new Map(newTrs.map(tr => [tr.historyId, tr]));
  const deletedTestsById = new Map(removedHtrs.map(htr => [htr.historyId, htr]));
  const enabledTestsById = new Map(enabledTrs.map(tr => [tr.historyId, tr]));
  const disabledTestsById = new Map(disabledTrs.map(tr => [tr.historyId, tr]));

  // Including into future tree current tests + removed historical tests to be able to reflect removed historical tests
  const allTests: (TestResult | HistoryTestResult)[] = [
    ...trs,
    ...removedHtrs
  ];

  const getChangeType = (historyId?: string): "new" | "deleted" | "enabled" | "disabled" | "unchanged" => {
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
    addLeafToGroupFn
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
        };
      }
    },
    () => ({
      id: "root",
      value: undefined,
    })
  );

  return transformTreeMapNode<ExtendedTreeMapNode>(convertedTree, (node) => {
    const subtreeMetrics = calculateSubtreeMetrics(node);
    const colorValue = calculateColorValue(subtreeMetrics);

    if (isChildrenLeavesOnly(node)) {
      return {
        ...node,
        value: subtreeMetrics.totalTests,
        children: undefined,
        colorValue,
      };
    }

    return {
      ...node,
      colorValue,
    };
  });
};

export const coverageDiffTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: ({ testResults, historyDataPoints }) => {
    const testsWithBehaviorLabels = filterTestsWithBehaviorLabels(testResults);
    const closestHdp = historyDataPoints[0];
    const closestHtrs = closestHdp.testResults;
    const closestHtrsWithBehaviorLabels = filterTestsWithBehaviorLabels(Object.values(closestHtrs));
    const closestHtrsWithBehaviorLabelsById = Object.fromEntries(closestHtrsWithBehaviorLabels.map(htr => [htr.historyId, htr]));

    return createCoverageDiffTreeMap(testsWithBehaviorLabels, closestHtrsWithBehaviorLabelsById);
  },
};
