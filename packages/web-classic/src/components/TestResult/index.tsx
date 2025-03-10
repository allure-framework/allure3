import type { FunctionComponent, FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import * as styles from "@/components/BaseLayout/styles.scss";
import { TestResultAttachmentView } from "@/components/TestResult/TestResultAttachmentsView";
import TestResultEmpty from "@/components/TestResult/TestResultEmpty";
import TestResultHistoryView from "@/components/TestResult/TestResultHistory";
import { TestResultInfo } from "@/components/TestResult/TestResultInfo";
import { TestResultOverview } from "@/components/TestResult/TestResultOverview";
import { TestResultRetriesView } from "@/components/TestResult/TestResultRetriesView";
import { TestResultTabs, useTestResultTabsContext } from "@/components/TestResult/TestResultTabs";

export type TestResultViewProps = {
  testResult?: AwesomeTestResult;
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
  testResult?: AwesomeTestResult;
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
  testResult?: AwesomeTestResult;
};

const TestResult: FunctionComponent<TestResultProps> = ({ testResult }) => (
  <>
    <div className={styles.content}>
      {testResult ? <TestResultContent testResult={testResult} /> : <TestResultEmpty />}
    </div>
  </>
);

export default TestResult;
