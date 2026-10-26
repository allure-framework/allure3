import { computed } from "@preact/signals";
import type { ReportTestResult } from "types";

import { route } from "@/stores/router";

export const TEST_RESULT_TABS = ["overview", "history", "retries", "attachments"] as const;

export type TestResultTabId = (typeof TEST_RESULT_TABS)[number];

export const DEFAULT_TEST_RESULT_TAB: TestResultTabId = "overview";

/**
 * The tab requested by the URL (`#suites/<groupId>/<testResultId>/<tab>`), so a reload or a shared link opens it.
 * Moving to the previous or next result keeps it in the URL, links without it open the overview tab.
 */
export const selectedTestResultTab = computed<string>(
  () => route.value.params.testResultTab ?? DEFAULT_TEST_RESULT_TAB,
);

export const isTestResultTabAvailable = (testResult: ReportTestResult | undefined, tab: string): boolean => {
  switch (tab) {
    case "overview":
      return true;
    case "history":
      return Boolean(testResult?.history?.length);
    case "retries":
      return Boolean(testResult?.retries?.length);
    case "attachments":
      return Boolean(testResult?.attachments?.length);
    default:
      return false;
  }
};

/**
 * Returns the tab to show: the requested one when it is available, the fallback otherwise.
 */
export const resolveTestResultTab = <T extends string | undefined>(
  tab: string | undefined,
  isAvailable: (id: string) => boolean,
  fallback: T,
): string | T => (tab !== undefined && isAvailable(tab) ? tab : fallback);
