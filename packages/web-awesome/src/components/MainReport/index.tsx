import { Counter, Loadable } from "@allurereport/web-components";
import clsx from "clsx";
import { NavTab, NavTabs, NavTabsList, useNavTabsContext } from "@/components/NavTabs";
import { ReportBody } from "@/components/ReportBody";
import { ReportGlobalAttachments } from "@/components/ReportGlobalAttachments";
import { ReportGlobalErrors } from "@/components/ReportGlobalErrors";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportMetadata } from "@/components/ReportMetadata";
import { reportStatsStore } from "@/stores";
import { useI18n } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { isSplitMode } from "@/stores/layout";
import { qualityGateStore } from "@/stores/qualityGate";
import { ReportQualityGateResults } from "../ReportQualityGateResults";
import * as styles from "./styles.scss";

enum ReportRootTab {
  Results = "results",
  QualityGate = "qualityGate",
  GlobalAttachments = "globalAttachments",
  GlobalErrors = "globalErrors",
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
          <NavTabs initialTab={ReportRootTab.Results}>
            <NavTabsList>
              <Loadable
                source={reportStatsStore}
                renderData={(stats) => (
                  <NavTab id={ReportRootTab.Results}>
                    {t("results")} <Counter count={stats?.total ?? 0} />
                  </NavTab>
                )}
              />
              <Loadable
                source={qualityGateStore}
                renderData={(results) => (
                  <>
                    <NavTab id={ReportRootTab.QualityGate}>
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
                    <NavTab id={ReportRootTab.GlobalAttachments}>
                      {t("globalAttachments")} <Counter count={attachments.length} />
                    </NavTab>
                    <NavTab id={ReportRootTab.GlobalErrors}>
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
