import { Heading, Loadable, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/compat";
import { HeaderActions } from "@/components/HeaderActions/HeaderActions";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { TreeList } from "@/components/Tree";
import { fetchStats, useI18n } from "@/stores";
import { route } from "@/stores/router";
import { fetchTestResult, testResultStore } from "@/stores/testResults";
import { fetchTreeData, treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

const Suites = () => {
  const { params } = route.value;
  const { testResultId } = params;

  useEffect(() => {
    fetchTreeData();
  }, []);
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
      <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <div />} />
    </div>
  );

  const SuitesList = () => {
    const { t } = useI18n("nav");
    return (
      <div className={styles.suites}>
        <Heading size={"s"} className={styles["suites-title"]}>
          {t("suites")}
        </Heading>

        <HeaderActions />
        <TreeList />
      </div>
    );
  };

  return <SideBySide left={<SuitesList />} right={testResult} />;
};

export default Suites;
