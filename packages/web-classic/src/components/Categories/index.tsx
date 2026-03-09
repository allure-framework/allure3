import { Heading, Loadable, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/compat";

import { CategoriesList } from "@/components/Categories/CategoriesList";
import { HeaderActions } from "@/components/HeaderActions/HeaderActions";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { useI18n } from "@/stores";
import { fetchCategoriesData } from "@/stores/categories";
import { route } from "@/stores/router";
import { fetchTestResult, testResultStore } from "@/stores/testResults";

import * as styles from "./styles.scss";

const Categories = () => {
  const { params } = route.value;
  const { testResultId } = params;

  useEffect(() => {
    fetchCategoriesData();
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

  const CategoriesSide = () => {
    const { t } = useI18n("nav");
    return (
      <div className={styles.suites}>
        <Heading size={"s"} className={styles["suites-title"]}>
          {t("categories")}
        </Heading>

        <HeaderActions />
        <CategoriesList />
      </div>
    );
  };

  return <SideBySide left={<CategoriesSide />} right={testResult} />;
};

export default Categories;
