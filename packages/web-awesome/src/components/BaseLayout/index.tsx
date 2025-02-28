import type { ModalTranslations } from "@allurereport/web-components";
import { Loadable, Modal, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";
import { Footer } from "@/components/Footer";
import MainReport from "@/components/MainReport";
import { ModalComponent } from "@/components/Modal";
import TestResult from "@/components/TestResult";
import { useI18n } from "@/stores";
import { isModalOpen, modalData } from "@/stores/modal";
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
  }, [testResultId]);

  const content = testResultId ? (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(data) => data[testResultId]}
      renderData={(testResult) => (
        <>
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

  return (
    <div className={styles.layout} data-testid="base-layout">
      {content}
    </div>
  );
};
