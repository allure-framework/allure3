import { Loadable, PageLoader } from "@allurereport/web-components";
import MainReport from "@/components/MainReport";
import TestResult from "@/components/TestResult";
import { route } from "@/stores/router";
import { testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export type BaseLayoutProps = {
  testResultId?: string;
};

export const BaseLayout = () => {
  const testResultId = route.value.params?.testResultId ?? null;

  const content = testResultId ? (
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
  ) : (
    <div className={styles.wrapper}>
      <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <MainReport />} />
    </div>
  );

  return (
    <div className={styles.layout} data-testid="base-layout">
      {content}
    </div>
  );
};
