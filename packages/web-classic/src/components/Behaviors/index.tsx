import { Heading, Loadable, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/compat";
import { BehaviorsList } from "@/components/Behaviors/BehaviorsList";
import { HeaderActions } from "@/components/HeaderActions/HeaderActions";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { useI18n } from "@/stores";
import { fetchBehaviorsData } from "@/stores/behaviors";
import { route } from "@/stores/router";
import { fetchTestResult, testResultStore } from "@/stores/testResults";
import * as styles from "./styles.scss";

const Behaviors = () => {
  const { params } = route.value;
  const { testResultId } = params;

  useEffect(() => {
    fetchBehaviorsData();
  }, []);

  useEffect(() => {
    if (testResultId) {
      fetchTestResult(testResultId);
    }
  }, [testResultId]);

  const testResult = (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(data) => data[testResultId]}
      renderError={() => <div />}
      renderData={(testResultItem) => (
        <>
          <div className={styles.wrapper} key={testResultItem?.id}>
            <TestResult testResult={testResultItem} />
          </div>
        </>
      )}
    />
  );

  const BehaviorsSide = () => {
    const { t } = useI18n("nav");
    return (
      <div className={styles.suites}>
        <Heading size={"s"} className={styles["suites-title"]}>
          {t("behaviors")}
        </Heading>

        <HeaderActions />
        <BehaviorsList />
      </div>
    );
  };

  return <SideBySide left={<BehaviorsSide />} right={testResult} />;
};

export default Behaviors;
