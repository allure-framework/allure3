import { ensureReportDataReady } from "@allurereport/web-commons";
import { Loadable, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/compat";
import { Footer } from "@/components/Footer";
import MainReport from "@/components/MainReport";
import Modal from "@/components/Modal";
import TestResult from "@/components/TestResult";
import TestResultEmpty from "@/components/TestResult/TestResultEmpty";
import { fetchStats, getLocale, getTheme } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { fetchEnvInfo } from "@/stores/envInfo";
import { fetchTestResult, fetchTestResultNav, testResultStore } from "@/stores/testResults";
import { fetchTreeData, treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export type BaseLayoutProps = {
  testResultId?: string;
};

export const BaseLayout = ({ testResultId }: BaseLayoutProps) => {
  useEffect(() => {
    getTheme();
    getLocale();
  }, []);

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav();
    } else {
      ensureReportDataReady();
      fetchStats();
      fetchPieChartData();
      fetchTreeData();
      fetchEnvInfo();
    }
  }, [testResultId]);

  const content = testResultId ? (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(data) => data[testResultId]}
      renderData={(testResult) => (
        <>
          <Modal testResult={testResult} />
          <div className={styles.wrapper} key={testResult?.id}>
            <TestResult testResult={testResult} />
            <Footer />
          </div>
        </>
      )}
    />
  ) : (
    <div className={styles.wrapper}>
      <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <MainReport />} />
      <Footer />
    </div>
  );

  return <div className={styles.layout}>{content}</div>;
};
