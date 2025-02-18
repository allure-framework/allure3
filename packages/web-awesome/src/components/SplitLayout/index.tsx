import { Loadable, Modal, PageLoader, Text } from "@allurereport/web-components";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import MainReport from "@/components/MainReport";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { isModalOpen, modalData } from "@/stores/modal";
import { route } from "@/stores/router";
import { fetchTestResult, fetchTestResultNav, testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

const MainReportWrapper = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <MainReport />
    </div>
  );
};

export const SplitLayout = () => {
  const { id: testResultId } = route.value;
  const [cachedMain, setCachedMain] = useState<JSX.Element | null>(null);

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav();
    }
  }, [testResultId]);

  const leftSide = (
    <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <MainReportWrapper />} />
  );

  const testResult = testResultId ? (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(allResults) => allResults[testResultId]}
      renderData={(tr) => (
        <>
          <div className={styles.wrapper}>
            <TestResult testResult={tr} />
          </div>
        </>
      )}
    />
  ) : (
    <div className={styles.empty}>
      <Text>Here will be test result</Text>
    </div>
  );

  useEffect(() => {
    if (!cachedMain) {
      setCachedMain(leftSide);
    }
  }, [cachedMain]);

  return (
    <div className={styles["side-by-side"]} data-testId={"split-layout"}>
      <Header className={styles.header} />
      <SideBySide left={cachedMain} right={testResult} />
      <Modal {...modalData.value} isModalOpen={isModalOpen.value} closeModal={() => (isModalOpen.value = false)} />
      <Footer />
    </div>
  );
};
