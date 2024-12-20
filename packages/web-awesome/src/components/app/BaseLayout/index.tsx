import { ensureReportDataReady, getReportOptions } from "@allurereport/web-commons";
import { useEffect } from "preact/compat";
import { Footer } from "@/components/app/Footer";
import MainReport from "@/components/app/MainReport";
import Modal from "@/components/app/Modal";
import TestResult from "@/components/app/TestResult";
import { Loadable } from "@/components/commons/Loadable";
import { PageLoader } from "@/components/commons/PageLoader";
import { fetchStats, getLocale, getTheme } from "@/stores";
import { fetchPieChartData } from "@/stores/chart";
import { fetchEnvInfo } from "@/stores/envInfo";
import { fetchTestResult, fetchTestResultNav, testResultStore } from "@/stores/testResults";
import { fetchTreeData, treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export const BaseLayout = ({ testResultId }) => {
  useEffect(() => {
    getTheme();
    getLocale();
  }, []);

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav();
    } else {
      Promise.all([
        ensureReportDataReady(),
        fetchStats(),
        fetchPieChartData(),
        fetchTreeData(),
        fetchEnvInfo(),
      ]);
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
          <div className={styles.wrapper}>
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
