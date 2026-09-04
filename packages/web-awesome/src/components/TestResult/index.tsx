import { computed } from "@preact/signals";
import clsx from "clsx";
import type { FunctionComponent, FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import type { ReportTestResult } from "types";

import { TrAttachmentView } from "@/components/TestResult/TrAttachmentsView";
import TrEmpty from "@/components/TestResult/TrEmpty";
import { TrEnvironmentsView } from "@/components/TestResult/TrEnvironmentsView";
import TrHistoryView from "@/components/TestResult/TrHistory";
import { TrInfo } from "@/components/TestResult/TrInfo";
import { TrOverview } from "@/components/TestResult/TrOverview";
import { TrResolutionCategoriesView } from "@/components/TestResult/TrResolutionCategories";
import { TrRetriesView } from "@/components/TestResult/TrRetriesView";
import { TrTabs } from "@/components/TestResult/TrTabs";
import { fetchTestEnvGroup } from "@/stores/env";
import { focusTestResultPane } from "@/stores/keyboard";
import { isSplitMode } from "@/stores/layout";
import { getCurrentTestResultTab } from "@/stores/testResultTabs";

import * as styles from "./styles.scss";

export type TrViewProps = {
  testResult?: ReportTestResult;
};

export type TrContentProps = {
  testResult?: ReportTestResult;
};

export type TrProps = {
  testResult?: ReportTestResult;
};

const view = computed(() => {
  const viewMap: Record<string, any> = {
    overview: TrOverview,
    resolutionCategories: TrResolutionCategoriesView,
    history: TrHistoryView,
    attachments: TrAttachmentView,
    retries: TrRetriesView,
    environments: TrEnvironmentsView,
  };
  return viewMap[getCurrentTestResultTab()];
});

const TrView: FunctionalComponent<TrViewProps> = ({ testResult }) => {
  const ViewComponent = view.value;

  return <ViewComponent testResult={testResult} />;
};

const TrContent: FunctionalComponent<TrContentProps> = ({ testResult }) => {
  return (
    <TrTabs initialTab="overview">
      <TrInfo testResult={testResult} />
      <TrView testResult={testResult} />
    </TrTabs>
  );
};

const TestResult: FunctionComponent<TrProps> = ({ testResult }) => {
  const split = isSplitMode.value;

  useEffect(() => {
    const testCaseId = testResult?.testCase?.id;

    if (testCaseId) {
      fetchTestEnvGroup(testCaseId);
    }
  }, [testResult]);

  return (
    <>
      <div
        className={clsx(styles.content, split && styles["scroll-inside"])}
        data-tr-scroll-container
        onMouseDown={() => focusTestResultPane()}
        role="presentation"
      >
        {testResult ? <TrContent testResult={testResult} /> : <TrEmpty />}
      </div>
    </>
  );
};

export default TestResult;
