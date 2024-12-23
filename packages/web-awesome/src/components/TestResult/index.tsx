import type { FunctionComponent, FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import * as styles from "@/components/app/BaseLayout/styles.scss";
import { TestResultAttachmentView } from "@/components/app/TestResult/TestResultAttachmentsView";
import TestResultEmpty from "@/components/app/TestResult/TestResultEmpty";
import { TestResultHeader } from "@/components/app/TestResult/TestResultHeader";
import TestResultHistoryView from "@/components/app/TestResult/TestResultHistory";
import { TestResultInfo } from "@/components/app/TestResult/TestResultInfo";
import { TestResultOverview } from "@/components/app/TestResult/TestResultOverview";
import { TestResultRetriesView } from "@/components/app/TestResult/TestResultRetriesView";
import { TestResultTabs, useTestResultTabsContext } from "@/components/app/TestResult/TestResultTabs";

export type TestResultViewProps = {
  testResult?: AllureAwesomeTestResult;
};

const TestResultView: FunctionalComponent<TestResultViewProps> = ({ testResult }) => {
  const { currentTab } = useTestResultTabsContext();
  const viewMap = {
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

const TestResult: FunctionComponent<TestResultProps> = ({ testResult }) => (
  <>
    <TestResultHeader testResult={testResult} />
    <div className={styles.content}>
      {testResult ? <TestResultContent testResult={testResult} /> : <TestResultEmpty />}
    </div>
  </>
);

export default TestResult;
