import type { TreeMapDataAccessor } from "../../charts.js";
import { isLeafsPredecessor, elevateLeafsData } from "../../charts.js";
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

type Leaf = TreeLeaf<Pick<TestResult, "name"> & {
  value: number; // net change: (new + enabled) - (deleted + disabled)
  changeType: "new" | "deleted" | "enabled" | "disabled" | "unchanged";
}>;

type Group = TreeGroup<Pick<TestResult, "name"> & {
  value: number; // net change for the group
  newCount: number;
  deletedCount: number;
  disabledCount: number;
  enabledCount: number;
  colorValue?: number;
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
  // Специальные случаи для новых и удаленных фич
  if (metrics.newCount > 0 && metrics.deletedCount === 0 && metrics.enabledCount === 0 && metrics.disabledCount === 0) {
    return 1.0; // Зеленый - только новые тесты
  }

  if (metrics.deletedCount > 0 && metrics.newCount === 0 && metrics.enabledCount === 0 && metrics.disabledCount === 0) {
    return 0.0; // Красный - только удаленные тесты
  }

  // Обычный случай: градиент от красного к зеленому
  if (metrics.totalTests === 0) {
    return 0.5; // Нейтральный цвет если нет предыдущих тестов
  }

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
    const historyPointTestResult = closestHtrs[tr.historyId!];

    return isSkipped(historyPointTestResult) && !isSkipped(tr);
  });
};

const getDisabledTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => {
    const historyPointTestResult = closestHtrs[tr.historyId!];

    return !isSkipped(historyPointTestResult) && isSkipped(tr);
  });
};

const calculateSubtreeMetrics = (node: TreeMapNode): SubtreeMetrics => {
  if (!node.children || node.children.length === 0) {
    // Leaf node - определяем метрики по changeType
    const changeType = (node as any).changeType;
    return {
      totalTests: 1,
      newCount: changeType === "new" ? 1 : 0,
      deletedCount: changeType === "deleted" ? 1 : 0,
      disabledCount: changeType === "disabled" ? 1 : 0,
      enabledCount: changeType === "enabled" ? 1 : 0,
    };
  }

  let totalTests = 0;
  const newCount = (node as any).newCount || 0;
  const deletedCount = (node as any).deletedCount || 0;
  const disabledCount = (node as any).disabledCount || 0;
  const enabledCount = (node as any).enabledCount || 0;

  // Считаем общее количество тестов из детей
  for (const child of node.children) {
    const childMetrics = calculateSubtreeMetrics(child);
    totalTests += childMetrics.totalTests;
  }

  return { totalTests, newCount, deletedCount, disabledCount, enabledCount };
};

const createCoverageDiffTreeMap = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TreeMapNode => {
  const newTrs = getNewTestResults(trs, closestHtrs);
  const removedTrs = getRemovedTestResults(trs, closestHtrs);
  const enabledTrs = getEnabledTestResults(trs, closestHtrs);
  const disabledTrs = getDisabledTestResults(trs, closestHtrs);

  const newTestsById = new Map(newTrs.map(tr => [tr.historyId, tr]));
  const deletedTestsById = new Map(removedTrs.map(tr => [tr.historyId, tr]));
  const enabledTestsById = new Map(enabledTrs.map(tr => [tr.historyId, tr]));
  const disabledTestsById = new Map(disabledTrs.map(tr => [tr.historyId, tr]));

  // Including into future tree current tests + removed historical tests to be able to reflect removed historical tests
  const allTests: (TestResult | HistoryTestResult)[] = [
    ...trs,
    ...removedTrs
  ];

  const leafFactoryFnWithMaps = (test: TestResult | HistoryTestResult): Leaf => {
    const historyId = test.historyId!;
    const baseNodeData = {
      nodeId: test.id,
      name: test.name,
    };

    if (newTestsById.has(historyId)) {
      return {
        ...baseNodeData,
        value: 1,
        changeType: "new",
      };
    }

    // Still invalid, because it must be checked on a group level (current tests won't be in removed, because they are current and only might have new tests)
    // BUT it might be utilizing mix of removed historical tests from allTests
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

  const convertedTree = convertTreeDataToTreeMapNode(treeByLabels, (node, _, isGroup) => {
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
  });

  return transformTreeMapNode(convertedTree, (node) => {
    const subtreeMetrics = calculateSubtreeMetrics(node);
    const colorValue = calculateColorValue(subtreeMetrics);

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

export const coverageDiffTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: ({ testResults, historyDataPoints }) => {
    const trs = filterTestsWithBehaviorLabels(testResults);
    const closestHdp = historyDataPoints[0];
    const closestHtrs = closestHdp.testResults;

    return createCoverageDiffTreeMap(trs, closestHtrs);
  },
};
