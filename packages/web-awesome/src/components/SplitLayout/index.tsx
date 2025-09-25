import { Loadable, PageLoader, Text } from "@allurereport/web-components";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import MainReport from "@/components/MainReport";
import SideBySide from "@/components/SideBySide";
import TestResult from "@/components/TestResult";
import { useI18n } from "@/stores";
import { route } from "@/stores/router";
import { testResultStore } from "@/stores/testResults";
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

const Loader = () => {
  return (
    <div className={styles.content}>
      <PageLoader />
    </div>
  );
};

export const SplitLayout = () => {
  const testResultId = route.value.params?.testResultId ?? null;
  const [cachedMain, setCachedMain] = useState<JSX.Element | null>(null);
  const { t } = useI18n("controls");
  const leftSide = (
    <Loadable source={treeStore} renderLoader={() => <PageLoader />} renderData={() => <MainReportWrapper />} />
  );

  const TrView = () => {
    return testResultId ? (
      <Loadable
        source={testResultStore}
        renderLoader={() => <Loader />}
        transformData={(allResults) => {
          if (testResultId in allResults) {
            return allResults[testResultId];
          }
        }}
        renderData={(tr) => {
          return tr ? <TestResult testResult={tr} /> : <Loader />;
        }}
      />
    ) : (
      <div className={styles.empty}>
        <Text>{t("noSelectedTR")}</Text>
      </div>
    );
  };

  useEffect(() => {
    if (!cachedMain) {
      setCachedMain(leftSide);
    }
  }, [cachedMain]);

  return (
    <div className={styles["side-by-side"]} data-testId={"split-layout"}>
      <SideBySide left={cachedMain} right={<TrView />} />
    </div>
  );
};
