import clsx from "clsx";
import type { FunctionComponent, FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import { TestResultAttachmentView } from "@/components/TestResult/TestResultAttachmentsView";
import TestResultEmpty from "@/components/TestResult/TestResultEmpty";
import { TestResultHeader } from "@/components/TestResult/TestResultHeader";
import TestResultHistoryView from "@/components/TestResult/TestResultHistory";
import { TestResultInfo } from "@/components/TestResult/TestResultInfo";
import { TestResultOverview } from "@/components/TestResult/TestResultOverview";
import { TestResultRetriesView } from "@/components/TestResult/TestResultRetriesView";
import { TestResultTabs, useTestResultTabsContext } from "@/components/TestResult/TestResultTabs";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

export type TestResultViewProps = {
  testResult?: AllureAwesomeTestResult;
};

const TestResultView: FunctionalComponent<TestResultViewProps> = ({ testResult }) => {
  const { currentTab } = useTestResultTabsContext();
  const viewMap: Record<string, any> = {
    overview: TestResultOverview,
    history: TestResultHistoryView,
    attachments: TestResultAttachmentView,
    retries: TestResultRetriesView,
  };
  const ViewComponent = viewMap[currentTab];

  return <ViewComponent testResult={testResult} />;
};

export type TestResultContentProps = {
  testResult?: AllureAwesomeTestResult;
};

const TestResultContent: FunctionalComponent<TestResultContentProps> = ({ testResult }) => {
  return (
    <TestResultTabs initialTab="overview">
      <TestResultInfo testResult={testResult} />
      <TestResultView testResult={testResult} />
    </TestResultTabs>
  );
};

export type TestResultProps = {
  testResult?: AllureAwesomeTestResult;
};

const TestResult: FunctionComponent<TestResultProps> = ({ testResult }) => {
  const splitModeClass = isSplitMode.value ? styles["scroll-inside"] : "";

  return (
    <>
      {!isSplitMode.value && <TestResultHeader testResult={testResult} />}
      <div className={clsx(styles.content, splitModeClass)}>
        {testResult ? <TestResultContent testResult={testResult} /> : <TestResultEmpty />}
      </div>
    </>
  );
};

export default TestResult;
