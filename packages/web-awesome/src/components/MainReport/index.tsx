import { Counter, Loadable } from "@allurereport/web-components";
import clsx from "clsx";
import { useEffect } from "preact/hooks";
import { NavTab, NavTabs, NavTabsList, useNavTabsContext } from "@/components/NavTabs";
import { ReportBody } from "@/components/ReportBody";
import { ReportCategories } from "@/components/ReportCategories";
import { ReportGlobalAttachments } from "@/components/ReportGlobalAttachments";
import { ReportGlobalErrors } from "@/components/ReportGlobalErrors";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportMetadata } from "@/components/ReportMetadata";
import { reportStatsStore, useI18n } from "@/stores";
import { categoriesStore } from "@/stores/categories";
import { currentEnvironment } from "@/stores/env";
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
  Categories = "categories",
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
  [ReportRootTab.Categories]: () => <ReportCategories />,
};

const MainReportContent = () => {
  const { currentTab } = useNavTabsContext();
  const tab = (currentTab as ReportRootTab) || ReportRootTab.Results;
  const Content = viewsByTab[tab];

  return <Content />;
};

const MainReport = () => {
  const { t } = useI18n("tabs");
  const rootTabToReportTab: Record<string, ReportRootTab> = {
    categories: ReportRootTab.Categories,
    qualityGate: ReportRootTab.QualityGate,
    globalAttachments: ReportRootTab.GlobalAttachments,
    globalErrors: ReportRootTab.GlobalErrors,
  };
  const reportTabToRootTab: Partial<Record<ReportRootTab, string>> = {
    [ReportRootTab.Categories]: "categories",
    [ReportRootTab.QualityGate]: "qualityGate",
    [ReportRootTab.GlobalAttachments]: "globalAttachments",
    [ReportRootTab.GlobalErrors]: "globalErrors",
  };
  const initialTab = rootTabRoute.value.matches
    ? (rootTabToReportTab[rootTabRoute.value.params.rootTab] ?? ReportRootTab.Results)
    : ReportRootTab.Results;

  const RootTab = (props: { id: ReportRootTab; children: any }) => {
    const { id, children } = props;
    const { currentTab, setCurrentTab } = useNavTabsContext();
    const isCurrentTab = currentTab === id;

    const handleClick = () => {
      if (isCurrentTab) {
        return;
      }
      setCurrentTab(id);
      if (id === ReportRootTab.Results) {
        if (currentTrId.value) {
          navigateToPlainTestResult({ testResultId: currentTrId.value, tab: trCurrentTab.value });
        } else {
          navigateToRoot();
        }
        return;
      }
      const rootTab = reportTabToRootTab[id];
      if (rootTab) {
        if (currentTrId.value) {
          navigateToRootTabTestResult({ rootTab, testResultId: currentTrId.value, tab: trCurrentTab.value });
        } else {
          navigateToRootTabRoot({ rootTab });
        }
      } else {
        navigateToRoot();
      }
    };

    return (
      <NavTab id={id} onClick={handleClick} isCurrentTab={isCurrentTab}>
        {children}
      </NavTab>
    );
  };

  // @ts-ignore
  const RootTabRouteSync = () => {
    const { currentTab, setCurrentTab } = useNavTabsContext();
    const routeKey = rootTabRoute.value.matches ? (rootTabRoute.value.params.rootTab ?? "") : "";
    useEffect(() => {
      const routeMatches = rootTabRoute.value.matches;
      const routeTab = routeMatches ? rootTabRoute.value.params.rootTab : undefined;
      const mapped = routeMatches ? (rootTabToReportTab[routeTab] ?? ReportRootTab.Results) : ReportRootTab.Results;
      if (currentTab !== mapped) {
        setCurrentTab(mapped);
      }
    }, [currentTab, setCurrentTab, routeKey]);
    return null;
  };

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
                    <RootTab id={ReportRootTab.Categories}>
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
