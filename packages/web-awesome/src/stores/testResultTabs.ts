import { currentEnvironment } from "@/stores/env";
import { navigateToTestResultTab } from "@/stores/router";
import { currentTrId, trCurrentTab } from "@/stores/testResult";
import { testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";

export const TEST_RESULT_TAB = {
  Overview: "overview",
  ResolutionCategories: "resolutionCategories",
  History: "history",
  Retries: "retries",
  Attachments: "attachments",
  Environments: "environments",
} as const;

export type TestResultTabId = (typeof TEST_RESULT_TAB)[keyof typeof TEST_RESULT_TAB];

const TEST_RESULT_TAB_ORDER: TestResultTabId[] = [
  TEST_RESULT_TAB.Overview,
  TEST_RESULT_TAB.ResolutionCategories,
  TEST_RESULT_TAB.History,
  TEST_RESULT_TAB.Retries,
  TEST_RESULT_TAB.Attachments,
  TEST_RESULT_TAB.Environments,
];

const TEST_RESULT_TABS_WITHOUT_RESOLUTION = TEST_RESULT_TAB_ORDER.filter(
  (tab) => tab !== TEST_RESULT_TAB.ResolutionCategories,
);

const getTreeLeafByTestResultId = (testResultId: string | undefined) => {
  if (!testResultId) {
    return undefined;
  }

  const trees = treeStore.value.data;

  if (!trees) {
    return undefined;
  }

  const envIds = currentEnvironment.value ? [currentEnvironment.value] : Object.keys(trees);

  for (const envId of envIds) {
    const leavesById = trees[envId]?.leavesById;

    if (!leavesById) {
      continue;
    }

    const directLeaf = leavesById[testResultId];

    if (directLeaf) {
      return directLeaf;
    }

    const leaf = Object.values(leavesById).find((item) => item.nodeId === testResultId);

    if (leaf) {
      return leaf;
    }
  }

  return undefined;
};

const getAvailableTestResultTabs = (testResultId = currentTrId.value): TestResultTabId[] => {
  const testResult = testResultId ? testResultStore.value.data?.[testResultId] : undefined;

  if (testResult) {
    return testResult.resolution ? TEST_RESULT_TAB_ORDER : TEST_RESULT_TABS_WITHOUT_RESOLUTION;
  }

  if (getTreeLeafByTestResultId(testResultId)?.resolution) {
    return TEST_RESULT_TAB_ORDER;
  }

  return TEST_RESULT_TABS_WITHOUT_RESOLUTION;
};

export const getTestResultTabForTestResultId = (
  testResultId: string | undefined,
  tab = trCurrentTab.value,
): TestResultTabId => {
  const nextTab = tab as TestResultTabId;

  if (getAvailableTestResultTabs(testResultId).includes(nextTab)) {
    return nextTab;
  }

  return TEST_RESULT_TAB.Overview;
};

export const getCurrentTestResultTab = (): TestResultTabId => {
  return getTestResultTabForTestResultId(currentTrId.value);
};

export const navigateToTestResultTabById = (tab: TestResultTabId) => {
  const testResultId = currentTrId.value;

  if (!testResultId) {
    return;
  }

  if (!getAvailableTestResultTabs().includes(tab)) {
    return;
  }

  if (tab === TEST_RESULT_TAB.Overview) {
    navigateToTestResultTab({ testResultId, tab: "" });
    return;
  }

  navigateToTestResultTab({ testResultId, tab });
};

export const cycleTestResultTab = (direction: "next" | "prev") => {
  const testResultId = currentTrId.value;

  if (!testResultId) {
    return;
  }

  const current = getCurrentTestResultTab();
  const tabs = getAvailableTestResultTabs();
  const index = tabs.indexOf(current);
  const nextIndex = direction === "next" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;

  navigateToTestResultTabById(tabs[nextIndex]!);
};
