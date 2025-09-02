import { capitalize, statusesList } from "@allurereport/core-api";
import { Counter, Loadable } from "@allurereport/web-components";
import { statsStore } from "@/stores";
import { useI18n } from "@/stores/locale";
import { Tab, Tabs, TabsList } from "../Tabs";
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
        <TabsList>
          <Loadable
            source={statsStore}
            renderData={(stats) => {
              const allStatuses = statusesList
                .map((status) => ({ status, value: stats[status] }))
                .filter(({ value }) => value)
                .map(({ status, value }) => (
                  <Tab data-testid={`tab-${status}`} key={status} id={status}>
                    {capitalize(t(status) ?? status)} <Counter count={value} size="s" status={status} />
                  </Tab>
                ));

              return (
                <>
                  <Tab data-testid="tab-all" id={ALL_TAB}>
                    {capitalize(t("total"))} <Counter count={stats?.total ?? 0} size="s" />
                  </Tab>
                  {allStatuses}
                </>
              );
            }}
          />
        </TabsList>
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
        <Tabs initialTab="total">
          <Header />
          <Body />
        </Tabs>
      </section>
    </ReportContentProvider>
  );
};
