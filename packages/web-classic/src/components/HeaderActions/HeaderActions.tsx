import { type Statistic, capitalize, statusesList } from "@allurereport/core-api";
import { Counter, Loadable, SearchBox } from "@allurereport/web-components";

import { SortBy } from "@/components/HeaderActions/SortBy";
import { Tab } from "@/components/Tabs";
import { useTreeStore } from "@/components/Tree/context";
import { statsStore } from "@/stores";
import { useI18n } from "@/stores/locale";
import { currentTab } from "@/stores/tabs";

import { Filters } from "./Filters";
import { TreeControls } from "./TreeControls";

import * as styles from "./styles.scss";

const ALL_TAB = "total";

const Search = () => {
  const { filters, setQuery } = useTreeStore();
  const { query } = filters.value;
  const { t } = useI18n("search");

  return <SearchBox placeholder={t("search-placeholder")} value={query} onChange={setQuery} />;
};

/**
 * Status tabs with the counters of the tree on the current page:
 * e.g. the Categories tree holds only the tests that matched a category, so its tabs differ from the report totals.
 * Report totals are shown only while the tree is loading.
 * A status tab is hidden when the tree has no tests with that status, unless it is the selected tab.
 */
const StatusTabs = (props: { stats: Statistic }) => {
  const { stats } = props;
  const { t } = useI18n("statuses");
  const allStatuses = statusesList
    .map((status) => ({ status, value: stats[status] ?? 0 }))
    .filter(({ status, value }) => value > 0 || currentTab.value === status)
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
};

export const HeaderActions = () => {
  const { stats: treeStats } = useTreeStore();

  return (
    <div className={styles.headerActions}>
      <div className={styles["header-search"]}>
        <Search />
        <Filters />
      </div>
      <div className={styles["header-filters"]}>
        <div className={styles["header-tabs"]}>
          {treeStats.value ? (
            <StatusTabs stats={treeStats.value} />
          ) : (
            <Loadable source={statsStore} renderData={(stats) => <StatusTabs stats={stats} />} />
          )}
        </div>
        <div className={styles["header-controls"]}>
          <SortBy />
          <TreeControls />
        </div>
      </div>
    </div>
  );
};
