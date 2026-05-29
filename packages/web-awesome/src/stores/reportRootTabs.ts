import { categoriesStore } from "@/stores/categories";
import { currentEnvironment } from "@/stores/env";
import { globalsStore } from "@/stores/globals";
import {
  navigateToPlainTestResult,
  navigateToRoot,
  navigateToRootTabRoot,
  navigateToRootTabTestResult,
  rootTabRoute,
} from "@/stores/router";
import { currentTrId, trCurrentTab } from "@/stores/testResult";

export const REPORT_ROOT_TAB = {
  Results: "results",
  Categories: "categories",
  QualityGate: "qualityGate",
  GlobalAttachments: "globalAttachments",
  GlobalErrors: "globalErrors",
} as const;

export type ReportRootTabId = (typeof REPORT_ROOT_TAB)[keyof typeof REPORT_ROOT_TAB];

const REPORT_ROOT_TAB_ORDER: ReportRootTabId[] = [
  REPORT_ROOT_TAB.Results,
  REPORT_ROOT_TAB.Categories,
  REPORT_ROOT_TAB.QualityGate,
  REPORT_ROOT_TAB.GlobalAttachments,
  REPORT_ROOT_TAB.GlobalErrors,
];

export const getAvailableReportRootTabs = (): ReportRootTabId[] => {
  const tabs: ReportRootTabId[] = [REPORT_ROOT_TAB.Results];
  const categories = categoriesStore.value.data;

  if (categories?.roots?.length) {
    tabs.push(REPORT_ROOT_TAB.Categories);
  }

  tabs.push(REPORT_ROOT_TAB.QualityGate, REPORT_ROOT_TAB.GlobalAttachments, REPORT_ROOT_TAB.GlobalErrors);

  return tabs;
};

export const getCurrentReportRootTab = (): ReportRootTabId => {
  if (rootTabRoute.value.matches) {
    const rootTab = rootTabRoute.value.params.rootTab as ReportRootTabId;

    if (REPORT_ROOT_TAB_ORDER.includes(rootTab)) {
      return rootTab;
    }
  }

  return REPORT_ROOT_TAB.Results;
};

export const navigateToReportRootTab = (tab: ReportRootTabId) => {
  if (!getAvailableReportRootTabs().includes(tab)) {
    return;
  }

  const testResultId = currentTrId.value;
  const trTab = trCurrentTab.value;

  if (tab === REPORT_ROOT_TAB.Results) {
    if (testResultId) {
      navigateToPlainTestResult({ testResultId, tab: trTab });
    } else {
      navigateToRoot();
    }
    return;
  }

  if (testResultId) {
    navigateToRootTabTestResult({ rootTab: tab, testResultId, tab: trTab });
    return;
  }

  navigateToRootTabRoot({ rootTab: tab });
};

export const cycleReportRootTab = (direction: "next" | "prev") => {
  const available = getAvailableReportRootTabs();
  const current = getCurrentReportRootTab();
  const index = available.indexOf(current);

  if (index < 0) {
    navigateToReportRootTab(available[0] ?? REPORT_ROOT_TAB.Results);
    return;
  }

  const nextIndex =
    direction === "next" ? (index + 1) % available.length : (index - 1 + available.length) % available.length;

  navigateToReportRootTab(available[nextIndex]!);
};
