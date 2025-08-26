import { Counter, Loadable } from "@allurereport/web-components";
import clsx from "clsx";
import { NavTab, NavTabs, NavTabsList, useNavTabsContext } from "@/components/NavTabs";
import { ReportBody } from "@/components/ReportBody";
import { ReportGlobalAttachments } from "@/components/ReportGlobalAttachments";
import { ReportGlobalErrors } from "@/components/ReportGlobalErrors";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportMetadata } from "@/components/ReportMetadata";
import { reportStatsStore } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { isSplitMode } from "@/stores/layout";
import * as styles from "./styles.scss";

enum ReportRootTab {
  Results = "results",
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
};

const MainReportContent = () => {
  const { currentTab } = useNavTabsContext();
  const tab = (currentTab as ReportRootTab) || ReportRootTab.Results;
  const Content = viewsByTab[tab];

  return <Content />;
};

const MainReport = () => {
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
                    Results <Counter count={stats?.total ?? 0} />
                  </NavTab>
                )}
              />
              <Loadable
                source={globalsStore}
                renderData={({ attachments = [], errors = [] }) => (
                  <>
                    <NavTab id={ReportRootTab.GlobalAttachments}>
                      Global Attachments <Counter count={attachments.length} />
                    </NavTab>
                    <NavTab id={ReportRootTab.GlobalErrors}>
                      Global Errors <Counter count={errors.length} />
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
