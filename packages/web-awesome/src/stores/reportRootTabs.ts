import { categoriesStore } from "@/stores/categories";
import { resolutionCategoriesStore } from "@/stores/resolutionCategories";
import {
  navigateToPlainTestResult,
  navigateToRoot,
  navigateToRootTabRoot,
  navigateToRootTabTestResult,
} from "@/stores/router";
import { currentTrId, trCurrentTab } from "@/stores/testResult";

export const REPORT_ROOT_TAB = {
  Results: "results",
  Categories: "categories",
  QualityGate: "qualityGate",
  GlobalAttachments: "globalAttachments",
  GlobalErrors: "globalErrors",
  ResolutionCategories: "resolutionCategories",
} as const;

export type ReportRootTabId = (typeof REPORT_ROOT_TAB)[keyof typeof REPORT_ROOT_TAB];

export const getAvailableReportRootTabs = (): ReportRootTabId[] => {
  const tabs: ReportRootTabId[] = [REPORT_ROOT_TAB.Results];
  const categories = categoriesStore.value.data;
  const resolutionCategories = resolutionCategoriesStore.value.data;

  if (categories?.roots?.length) {
    tabs.push(REPORT_ROOT_TAB.Categories);
  }

  if (resolutionCategories?.groups.length) {
    tabs.push(REPORT_ROOT_TAB.ResolutionCategories);
  }

  tabs.push(REPORT_ROOT_TAB.QualityGate, REPORT_ROOT_TAB.GlobalAttachments, REPORT_ROOT_TAB.GlobalErrors);

  return tabs;
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
