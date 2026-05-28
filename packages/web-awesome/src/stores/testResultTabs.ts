import { navigateToTestResultTab } from "@/stores/router";
import { currentTrId, trCurrentTab } from "@/stores/testResult";

export const TEST_RESULT_TAB = {
  Overview: "overview",
  History: "history",
  Retries: "retries",
  Attachments: "attachments",
  Environments: "environments",
} as const;

export type TestResultTabId = (typeof TEST_RESULT_TAB)[keyof typeof TEST_RESULT_TAB];

const TEST_RESULT_TAB_ORDER: TestResultTabId[] = [
  TEST_RESULT_TAB.Overview,
  TEST_RESULT_TAB.History,
  TEST_RESULT_TAB.Retries,
  TEST_RESULT_TAB.Attachments,
  TEST_RESULT_TAB.Environments,
];

export const getCurrentTestResultTab = (): TestResultTabId => {
  const tab = trCurrentTab.value as TestResultTabId;

  if (TEST_RESULT_TAB_ORDER.includes(tab)) {
    return tab;
  }

  return TEST_RESULT_TAB.Overview;
};

export const navigateToTestResultTabById = (tab: TestResultTabId) => {
  const testResultId = currentTrId.value;

  if (!testResultId) {
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
  const index = TEST_RESULT_TAB_ORDER.indexOf(current);
  const nextIndex =
    direction === "next"
      ? (index + 1) % TEST_RESULT_TAB_ORDER.length
      : (index - 1 + TEST_RESULT_TAB_ORDER.length) % TEST_RESULT_TAB_ORDER.length;

  navigateToTestResultTabById(TEST_RESULT_TAB_ORDER[nextIndex]!);
};
