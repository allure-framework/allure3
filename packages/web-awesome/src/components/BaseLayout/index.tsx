import { Loadable, PageLoader, Text } from "@allurereport/web-components";
import type { JSX } from "preact";
import { useEffect } from "preact/compat";
import { useState } from "preact/hooks";
import { Footer } from "@/components/Footer";
import MainReport from "@/components/MainReport";
import Modal from "@/components/Modal";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { route } from "@/stores/router";
import { fetchTestResult, fetchTestResultNav, testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export const BaseLayout = () => {
  const { id: testResultId } = route.value;

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
      fetchTestResultNav();
    }
  }, [testResultId]);

  const [cachedMain, setCachedMain] = useState<JSX.Element | null>(null);

  useEffect(() => {
    if (!cachedMain) {
      setCachedMain(
        <div className={styles.wrapper}>
          <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <MainReport />} />
        </div>,
      );
    }
  }, [cachedMain]);

  const testResult = testResultId ? (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(data) => data[testResultId]}
      renderData={(tr) => (
        <>
          <Modal testResult={tr} />
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

  return (
    <div className={styles["side-by-side"]}>
      <SideBySide left={cachedMain} right={testResult} />
      <Footer />
    </div>
  );
};
