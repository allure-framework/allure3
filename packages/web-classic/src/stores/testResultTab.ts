import { signal } from "@preact/signals";
import type { ReportTestResult } from "types";

export const TEST_RESULT_TABS = ["overview", "history", "retries", "attachments"] as const;

export type TestResultTabId = (typeof TEST_RESULT_TABS)[number];

export const DEFAULT_TEST_RESULT_TAB: TestResultTabId = "overview";

/**
 * The tab the user picked last. It is kept in memory between test results, so moving to the previous or next
 * result stays on the same tab when the result has it. It is not part of the URL: a reload opens the overview tab.
 */
export const selectedTestResultTab = signal<string>(DEFAULT_TEST_RESULT_TAB);

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
