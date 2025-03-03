import { Loadable, PageLoader } from "@allurereport/web-components";
import { Footer } from "@/components/Footer";
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
  const { id: testResultId } = route.value;

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
