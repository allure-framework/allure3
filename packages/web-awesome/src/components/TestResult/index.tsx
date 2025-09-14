import clsx from "clsx";
import type { FunctionComponent, FunctionalComponent } from "preact";
import { useEffect } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { TrAttachmentView } from "@/components/TestResult/TrAttachmentsView";
import TrEmpty from "@/components/TestResult/TrEmpty";
import { TrEnvironmentsView } from "@/components/TestResult/TrEnvironmentsView";
import TrHistoryView from "@/components/TestResult/TrHistory";
import { TrInfo } from "@/components/TestResult/TrInfo";
import { TrOverview } from "@/components/TestResult/TrOverview";
import { TrRetriesView } from "@/components/TestResult/TrRetriesView";
import { TrTabs, useTestResultTabsContext } from "@/components/TestResult/TrTabs";
import { fetchTestEnvGroup } from "@/stores/env";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

export type TrViewProps = {
  testResult?: AwesomeTestResult;
};

export type TrContentProps = {
  testResult?: AwesomeTestResult;
};

export type TrProps = {
  testResult?: AwesomeTestResult;
};

const TrView: FunctionalComponent<TrViewProps> = ({ testResult }) => {
  const { currentTab } = useTestResultTabsContext();
  const viewMap: Record<string, any> = {
    overview: TrOverview,
    history: TrHistoryView,
    attachments: TrAttachmentView,
    retries: TrRetriesView,
    environments: TrEnvironmentsView,
  };
  const ViewComponent = viewMap[currentTab];

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
  const splitModeClass = isSplitMode.value ? styles["scroll-inside"] : "";

  useEffect(() => {
    const testCaseId = testResult?.testCase?.id;

    if (testCaseId) {
      fetchTestEnvGroup(testCaseId);
    }
  }, [testResult]);

  return (
    <>
      <div className={clsx(styles.content, splitModeClass)}>
        {testResult ? <TrContent testResult={testResult} /> : <TrEmpty />}
      </div>
    </>
  );
};

export default TestResult;
