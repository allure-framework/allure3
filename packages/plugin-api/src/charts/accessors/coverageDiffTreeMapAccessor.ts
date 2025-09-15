import type { TreeMapDataAccessor } from "../../charts.js";
import { isLeafsPredecessor } from "../../charts.js";
import type { TreeMapNode, TestResult, HistoryTestResult, TreeLeaf, TreeGroup } from "@allurereport/core-api";
import { behaviorLabels } from "./utils/behavior.js";
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
  value: number; // net change: (new + enabled) - (deleted + disabled)
  changeType: "new" | "deleted" | "enabled" | "disabled" | "unchanged";
};
type Leaf = TreeLeaf<LeafData>;

type GroupData = Pick<TestResult, "name"> & {
  value: number; // net change for the group
  newCount: number;
  deletedCount: number;
  disabledCount: number;
  enabledCount: number;
  colorValue?: number;
};
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

  // Преобразуем в диапазон 0-1, где:
  // -1 (только удаления) = 0.0 (красный)
  // 0 (без изменений) = 0.5 (белый)
  // +1 (только добавления) = 1.0 (зеленый)
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
    const changeType = node.changeType;
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
  let newCount = node.newCount ?? 0;
  let deletedCount = node.deletedCount ?? 0;
  let disabledCount = node.disabledCount ?? 0;
  let enabledCount = node.enabledCount ?? 0;

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

  const leafFactoryFnWithMaps = (test: TestResult | HistoryTestResult): Leaf => {
    const historyId = test.historyId!;
    const baseNodeData = {
      nodeId: test.id,
      name: test.name,
    };

    // Leaf can be only one of the following: new, deleted, enabled, disabled, unchanged
    if (newTestsById.has(historyId)) {
      return {
        ...baseNodeData,
        value: 1,
        changeType: "new",
      };
    }

    if (deletedTestsById.has(historyId)) {
      return {
        ...baseNodeData,
        value: -1,
        changeType: "deleted",
      };
    }

    if (enabledTestsById.has(historyId)) {
      return {
        ...baseNodeData,
        value: 1,
        changeType: "enabled",
      };
    }

    if (disabledTestsById.has(historyId)) {
      return {
        ...baseNodeData,
        value: -1,
        changeType: "disabled",
      };
    }

    return {
      ...baseNodeData,
      value: 0,
      changeType: "unchanged",
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
      console.log("\n#### node ####", {isGroup, node});
      const baseNode = {
        id: node.name,
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

    if (isLeafsPredecessor(node)) {
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
    const closestHdp = historyDataPoints[0];
    const closestHtrs = closestHdp.testResults;

    return createCoverageDiffTreeMap(testResults, closestHtrs);
  },
};
