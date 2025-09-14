import type { TreeMapDataAccessor } from "../../charts.js";
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
  value: number; // net number of tests in a leaf (always 1)
  enabled?: boolean; // wil be undefined if the test is not skipped in the previous run even if status changed
  disabled?: boolean; // will be undefined if the test is not skipped in the current run even if status changed
}>;

type Group = TreeGroup<Pick<TestResult, "name"> & {
  value: number; // ((new + enabled) - (deleted + disabled)) / the total number of tests in the previous run
  newCount: number;
  deletedCount: number;
  disabledCount: number;
  enabledCount: number;
}>;

const leafFactoryFn = ({ id, name }: TestResult): Leaf => ({
  nodeId: id,
  name,
  value: 1, // net number of tests in a leaf
});

const groupFactoryFn = (parentId: string | undefined, groupClassifier: string): Group => ({
  nodeId:  md5((parentId ? `${parentId}.` : "") + groupClassifier),
  name: groupClassifier,
  value: 0,
  newCount: 0,
  deletedCount: 0,
  disabledCount: 0,
  enabledCount: 0,
});

const addLeafToGroupFn = (group: Group, leaf: Leaf) => {
  group.value = (group?.value ?? 0) + (leaf.value ?? 0);
};

const isSkipped = (tr: TestResult | HistoryTestResult): boolean => tr.status === "skipped";

// OK
const getNewTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => !closestHtrs[tr.historyId!]);
};

const getRemovedTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): HistoryTestResult[] => {
  const historyPointTestResultsAsArray = Object.values(closestHtrs);
  const testResultsAsDictionary: Record<string, TestResult> = Object.fromEntries(trs.map((tr) => [tr.historyId, tr]));

  return historyPointTestResultsAsArray.filter((htr) => !testResultsAsDictionary[htr.historyId!]);
};

// OK
const getEnabledTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => {
    const historyPointTestResult = closestHtrs[tr.historyId!];

    return isSkipped(historyPointTestResult) && !isSkipped(tr);
  });
};

// OK
const getDisabledTestResults = (trs: TestResult[], closestHtrs: Record<string, HistoryTestResult>): TestResult[] => {
  return trs.filter((tr) => {
    const historyPointTestResult = closestHtrs[tr.historyId!];

    return !isSkipped(historyPointTestResult) && isSkipped(tr);
  });
};

const calculateSubtreeMetrics = (node: TreeMapNode): SubtreeMetrics => {
  if (!node.children || node.children.length === 0) {
      // Leaf node - value represents passed tests (1 for passed, 0 for failed)
      return { totalTests: 1, newCount: 0, deletedCount: 0, disabledCount: 0, enabledCount: 0 };
  }

  // Group node - aggregate metrics from children
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
  const removedTrs = getRemovedTestResults(trs, closestHtrs);
  const enabledTrs = getEnabledTestResults(trs, closestHtrs);
  const disabledTrs = getDisabledTestResults(trs, closestHtrs);

  const newTrsById = new Map(newTrs.map((tr) => [tr.historyId, tr]));
  const removedTrsById = new Map(removedTrs.map((tr) => [tr.historyId, tr]));
  const enabledTrsById = new Map(enabledTrs.map((tr) => [tr.historyId, tr]));
  const disabledTrsById = new Map(disabledTrs.map((tr) => [tr.historyId, tr]));

  const treeByLabels = createTreeByLabels<TestResult, Leaf, Group>(
      trs,
      behaviorLabels,
      leafFactoryFn,
      groupFactoryFn,
      addLeafToGroupFn
  );

  const convertedTree = convertTreeDataToTreeMapNode(treeByLabels, (node, _, isGroup) => ({
    id: node.name,
    value: isGroup ? undefined : node.value, // Only leaves have value (nivo tree map for some reason requires value for group to be omited for correct visualization)
  }));

  return convertedTree;
};

export const coverageDiffTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: ({ testResults, historyDataPoints }) => {
    const trs = filterTestsWithBehaviorLabels(testResults);
    const closestHdp = historyDataPoints[0];
    const closestHtrs = closestHdp.testResults;

    return createCoverageDiffTreeMap(trs, closestHtrs);
  },
};
