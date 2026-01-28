import { Counter, Loadable } from "@allurereport/web-components";
import clsx from "clsx";
import { NavTab, NavTabs, NavTabsList, useNavTabsContext } from "@/components/NavTabs";
import { ReportBody } from "@/components/ReportBody";
import { ReportErrorCategories } from "@/components/ReportErrorCategories";
import { ReportGlobalAttachments } from "@/components/ReportGlobalAttachments";
import { ReportGlobalErrors } from "@/components/ReportGlobalErrors";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportMetadata } from "@/components/ReportMetadata";
import { reportStatsStore, useI18n } from "@/stores";
import { categoriesStore } from "@/stores/errorCategories";
import { globalsStore } from "@/stores/globals";
import { isSplitMode } from "@/stores/layout";
import { qualityGateStore } from "@/stores/qualityGate";
import { activeTab, navigateTo } from "@/stores/router";
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
    <>
      <div className={clsx(styles.content, isSplitMode.value ? styles["scroll-inside"] : "")}>
        <ReportHeader />
        <div className={styles["main-report-tabs"]}>
          <NavTabs initialTab={activeTab}>
            <NavTabsList>
              <Loadable
                source={reportStatsStore}
                renderData={(stats) => (
                  <NavTab id={ReportRootTab.Results} onClick={() => navigateTo({ category: "" })}>
                    {t("results")} <Counter count={stats?.total ?? 0} />
                  </NavTab>
                )}
              />
              <Loadable
                source={categoriesStore}
                renderData={({ roots }) => (
                  <>
                    <NavTab
                      id={ReportRootTab.ErrorCategories}
                      onClick={() => navigateTo({ category: ReportRootTab.ErrorCategories })}
                    >
                      {t("errorCategories")} <Counter count={roots.length} />
                    </NavTab>
                  </>
                )}
              />
              <Loadable
                source={qualityGateStore}
                renderData={(results) => (
                  <>
                    <NavTab
                      id={ReportRootTab.QualityGate}
                      onClick={() => navigateTo({ category: ReportRootTab.QualityGate })}
                    >
                      {t("qualityGates")}{" "}
                      <Counter status={results.length > 0 ? "failed" : undefined} count={results.length} />
                    </NavTab>
                  </>
                )}
              />
              <Loadable
                source={globalsStore}
                renderData={({ attachments = [], errors = [] }) => (
                  <>
                    <NavTab
                      id={ReportRootTab.GlobalAttachments}
                      onClick={() => navigateTo({ category: ReportRootTab.GlobalAttachments })}
                    >
                      {t("globalAttachments")} <Counter count={attachments.length} />
                    </NavTab>
                    <NavTab
                      id={ReportRootTab.GlobalErrors}
                      onClick={() => navigateTo({ category: ReportRootTab.GlobalErrors })}
                    >
                      {t("globalErrors")}{" "}
                      <Counter status={errors.length > 0 ? "failed" : undefined} count={errors.length} />
                    </NavTab>
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
    </>
  );
};
export default MainReport;
