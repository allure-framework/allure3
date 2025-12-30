import { capitalize, statusesList } from "@allurereport/core-api";
import { Counter, Loadable } from "@allurereport/web-components";
import { reportStatsStore, statsByEnvStore } from "@/stores";
import { currentEnvironment } from "@/stores/env";
import { useI18n } from "@/stores/locale";
import { setTreeStatus, treeStatus } from "@/stores/treeFilters";
import { ReportTab, ReportTabsList } from "../ReportTabs";
import { TreeList } from "../Tree";
import { HeaderActions } from "./HeaderActions";
import { SortBy } from "./SortBy";
import { ReportContentProvider } from "./context";
import * as styles from "./styles.scss";

const ALL_TAB = "total";

const Header = () => {
  const { t } = useI18n("statuses");

  return (
    <header className={styles.header}>
      <HeaderActions />
      <div className={styles.headerRow}>
        <ReportTabsList>
          <Loadable
            source={statsByEnvStore}
            renderData={(stats) => {
              const currentEnv = stats[currentEnvironment.value] || reportStatsStore.value.data;
              const statList = statusesList
                .map((status) => {
                  return { status, value: currentEnv[status] };
                })
                .filter(({ value }) => value);
              const isStatListHaveCurrentTab = statList.filter(({ status }) => status === treeStatus.value);
              if (!isStatListHaveCurrentTab.length && treeStatus.value !== "total") {
                setTreeStatus("total");
              }

              const allStatuses = statList.map(({ status, value }) => (
                <ReportTab data-testid={`tab-${status}`} key={status} id={status}>
                  {capitalize(t(status) ?? status)} <Counter count={value} size="s" status={status} />
                </ReportTab>
              ));

              return (
                <>
                  <ReportTab data-testid="tab-all" id={ALL_TAB}>
                    {capitalize(t("total"))} <Counter count={currentEnv?.total ?? 0} size="s" />
                  </ReportTab>
                  {allStatuses}
                </>
              );
            }}
          />
        </ReportTabsList>
        <SortBy />
      </div>
    </header>
  );
};

const Body = () => {
  return (
    <div className={styles.body}>
      <TreeList />
    </div>
  );
};

export const ReportBody = () => {
  return (
    <ReportContentProvider>
      <section>
        <Header />
        <Body />
      </section>
    </ReportContentProvider>
  );
};
