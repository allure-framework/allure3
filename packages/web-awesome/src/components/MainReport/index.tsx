import { Counter, Loadable } from "@allurereport/web-components";
import clsx from "clsx";
import { useEffect } from "preact/hooks";
import { NavTab, NavTabs, NavTabsList, useNavTabsContext } from "@/components/NavTabs";
import { ReportBody } from "@/components/ReportBody";
import { ReportErrorCategories } from "@/components/ReportErrorCategories";
import { ReportGlobalAttachments } from "@/components/ReportGlobalAttachments";
import { ReportGlobalErrors } from "@/components/ReportGlobalErrors";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportMetadata } from "@/components/ReportMetadata";
import { reportStatsStore, useI18n } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { categoriesStore } from "@/stores/errorCategories";
import { globalsStore } from "@/stores/globals";
import { isSplitMode } from "@/stores/layout";
import { qualityGateStore } from "@/stores/qualityGate";
import {
  navigateToPlainTestResult,
  navigateToRoot,
  navigateToRootTabRoot,
  navigateToRootTabTestResult,
  rootTabRoute,
} from "@/stores/router";
import { currentTrId, trCurrentTab } from "@/stores/testResult";
import { ReportQualityGateResults } from "../ReportQualityGateResults";
import * as styles from "./styles.scss";

export enum ReportRootTab {
  Results = "results",
  QualityGate = "qualityGate",
  GlobalAttachments = "globalAttachments",
  GlobalErrors = "globalErrors",
  ErrorCategories = "errorCategories",
}

const viewsByTab = {
  [ReportRootTab.Results]: () => (
    <>
      <ReportMetadata />
      <ReportBody />
    </>
  ),
  [ReportRootTab.GlobalAttachments]: () => <ReportGlobalAttachments />,
  [ReportRootTab.GlobalErrors]: () => <ReportGlobalErrors />,
  [ReportRootTab.QualityGate]: () => <ReportQualityGateResults />,
  [ReportRootTab.ErrorCategories]: () => <ReportErrorCategories />,
};

const MainReportContent = () => {
  const { currentTab } = useNavTabsContext();
  const tab = (currentTab as ReportRootTab) || ReportRootTab.Results;
  const Content = viewsByTab[tab];

  return <Content />;
};

const MainReport = () => {
  const { t } = useI18n("tabs");

  return (
    <div className={clsx(styles.content, isSplitMode.value ? styles["scroll-inside"] : "")}>
      <ReportHeader />
      <div className={styles["main-report-tabs"]}>
        <NavTabs initialTab={initialTab}>
            <RootTabRouteSync />
          <NavTabsList>
            <Loadable
              source={reportStatsStore}
              renderData={(stats) => (
                <RootTab id={ReportRootTab.Results}>
                  {t("results")} <Counter count={stats?.total ?? 0} />
                </RootTab>
                )}
              />
              <Loadable
                source={categoriesStore}
                renderData={(categories) => {
                  if (!categories || !categories.roots?.length) {
                    return null;
                  }
                  return (
                    <>
                      <RootTab id={ReportRootTab.ErrorCategories}>
                        {t("categories")} <Counter count={categories.roots?.length} />
                      </RootTab>
                    </>
                  );
              }}
            />
            <Loadable
              source={qualityGateStore}
              renderData={(results) => {
                const currentEnvResults = currentEnvironment.value
                  ? (results[currentEnvironment.value] ?? [])
                  : Object.values(results).flatMap((envResults) => envResults);

                return (
                  <RootTab id={ReportRootTab.QualityGate}>
                    {t("qualityGates")}{" "}
                    <Counter
                      status={currentEnvResults.length > 0 ? "failed" : undefined}
                      count={currentEnvResults.length}
                    />
                  </RootTab>
                );
              }}
            />
            <Loadable
              source={globalsStore}
              renderData={({ attachments = [], errors = [] }) => (
                <>
                  <RootTab id={ReportRootTab.GlobalAttachments}>
                    {t("globalAttachments")} <Counter count={attachments.length} />
                  </RootTab>
                  <RootTab id={ReportRootTab.GlobalErrors}>
                    {t("globalErrors")}{" "}
                    <Counter status={errors.length > 0 ? "failed" : undefined} count={errors.length} />
                  </RootTab>
                </>
              )}
            />
          </NavTabsList>
          <div className={styles["main-report-tabs-content"]}>
            <MainReportContent />
          </div>
        </NavTabs>
      </div>
    </div>
  );
};
export default MainReport;
