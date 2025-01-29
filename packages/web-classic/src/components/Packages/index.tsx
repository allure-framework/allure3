import { Heading, Loadable, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/compat";
import { HeaderActions } from "@/components/HeaderActions/HeaderActions";
import { PackagesList } from "@/components/Packages/PackagesList";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { useI18n } from "@/stores";
import { fetchPackagesData } from "@/stores/packages";
import { route } from "@/stores/router";
import { fetchTestResult, testResultStore } from "@/stores/testResults";
import * as styles from "./styles.scss";

const Packages = () => {
  const { testResultId } = route.value.params;

  useEffect(() => {
    fetchPackagesData();
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

  const PackagesSide = () => {
    const { t } = useI18n("nav");
    return (
      <div className={styles.suites}>
        <Heading size={"s"} className={styles["suites-title"]}>
          {t("packages")}
        </Heading>

        <HeaderActions />
        <PackagesList />
      </div>
    );
  };

  return <SideBySide left={<PackagesSide />} right={testResult} />;
};

export default Packages;
