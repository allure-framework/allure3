import clsx from "clsx";
import type { FunctionComponent, FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { TrAttachmentView } from "@/components/TestResult/TrAttachmentsView";
import TrEmpty from "@/components/TestResult/TrEmpty";
import { TrHeader } from "@/components/TestResult/TrHeader";
import TrHistoryView from "@/components/TestResult/TrHistory";
import { TrInfo } from "@/components/TestResult/TrInfo";
import { TrOverview } from "@/components/TestResult/TrOverview";
import { TrRetriesView } from "@/components/TestResult/TrRetriesView";
import { TrTabs, useTestResultTabsContext } from "@/components/TestResult/TrTabs";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

export type TestResultViewProps = {
  testResult?: AwesomeTestResult;
};

const TrView: FunctionalComponent<TestResultViewProps> = ({ testResult }) => {
  const { currentTab } = useTestResultTabsContext();
  const viewMap: Record<string, any> = {
    overview: TrOverview,
    history: TrHistoryView,
    attachments: TrAttachmentView,
    retries: TrRetriesView,
  };
  const ViewComponent = viewMap[currentTab];

  return <ViewComponent testResult={testResult} />;
};

export type TestResultContentProps = {
  testResult?: AwesomeTestResult;
};

const TrContent: FunctionalComponent<TestResultContentProps> = ({ testResult }) => {
  return (
    <TrTabs initialTab="overview">
      <TrInfo testResult={testResult} />
      <TrView testResult={testResult} />
    </TrTabs>
  );
};

export type TestResultProps = {
  testResult?: AwesomeTestResult;
};

const TestResult: FunctionComponent<TestResultProps> = ({ testResult }) => {
  const splitModeClass = isSplitMode.value ? styles["scroll-inside"] : "";

  return (
    <>
      {!isSplitMode.value && <TrHeader testResult={testResult} />}
      <div className={clsx(styles.content, splitModeClass)}>
        {testResult ? <TrContent testResult={testResult} /> : <TrEmpty />}
      </div>
    </>
  );
};

export default TestResult;
