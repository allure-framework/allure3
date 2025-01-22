import { Heading, Loadable, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/compat";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { TreeList } from "@/components/Tree";
import { route } from "@/stores/router";
import { fetchTestResult, fetchTestResultNav, testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

const Suites = () => {
  const { params } = route.value;
  const parentId = params.id;
  const testResultId = params.subId;

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
    }
  }, [testResultId]);

  const testResult = testResultId ? (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(data) => data[testResultId]}
      renderData={(testResultItem) => (
        <>
          <div className={styles.wrapper} key={testResultItem?.id}>
            <TestResult testResult={testResultItem} />
          </div>
        </>
      )}
    />
  ) : (
    <div className={styles.wrapper}>
      <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <div>ia</div>} />
    </div>
  );

  const SuitesList = () => (
    <div className={styles.suites}>
      <Heading size={"s"}>Suites</Heading>
      <TreeList />
    </div>
  );

  return <SideBySide left={<SuitesList />} right={testResult} />;
};

export default Suites;
