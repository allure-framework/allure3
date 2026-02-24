import { Loadable, PageLoader } from "@allurereport/web-components";
import MainReport from "@/components/MainReport";
import TestResult from "@/components/TestResult";
import { rootTabRoute, testResultRoute } from "@/stores/router";
import { testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export type BaseLayoutProps = {
  testResultId?: string;
};

export const BaseLayout = () => {
  const matches = testResultRoute.value.matches || Boolean(rootTabRoute.value.params.testResultId);
  const testResultId = testResultRoute.value.matches
    ? testResultRoute.value.params.testResultId
    : rootTabRoute.value.params.testResultId;

  if (matches) {
    return (
      <div className={styles.layout} data-testid="base-layout">
        <Loadable
          source={testResultStore}
          renderLoader={() => <PageLoader />}
          transformData={(data) => data[testResultId]}
          renderData={(testResult) => (
            <>
              <div className={styles.wrapper} key={testResult?.id}>
                <TestResult testResult={testResult} />
              </div>
            </>
          )}
        />
      </div>
    );
  }

  return (
    <div className={styles.layout} data-testid="base-layout">
      <div className={styles.wrapper}>
        <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <MainReport />} />
      </div>
    </div>
  );
};
