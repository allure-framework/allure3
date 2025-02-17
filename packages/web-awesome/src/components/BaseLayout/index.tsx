import { Loadable, Modal, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { Footer } from "@/components/Footer";
import MainReport from "@/components/MainReport";
import TestResult from "@/components/TestResult";
import { modalData } from "@/stores/modal";
import { route } from "@/stores/router";
import { fetchTestResult, fetchTestResultNav, testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export type BaseLayoutProps = {
  testResultId?: string;
};

export const BaseLayout = () => {
  const { id: testResultId } = route.value;
  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav();
    }
  }, []);

  const content = testResultId ? (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(data) => data[testResultId]}
      renderData={(testResult) => (
        <>
          <Modal {...modalData.value} />
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
