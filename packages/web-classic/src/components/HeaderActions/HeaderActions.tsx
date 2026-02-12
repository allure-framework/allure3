import { capitalize, statusesList } from "@allurereport/core-api";
import { Counter, Loadable, SearchBox } from "@allurereport/web-components";
import { SortBy } from "@/components/HeaderActions/SortBy";
import { Tab } from "@/components/Tabs";
import { statsStore } from "@/stores";
import { useI18n } from "@/stores/locale";
import { setTreeQuery, treeFiltersStore } from "@/stores/tree";
import { Filters } from "./Filters";
import * as styles from "./styles.scss";

const Search = () => {
  const { query } = treeFiltersStore.value;
  const { t } = useI18n("search");

  return <SearchBox placeholder={t("search-placeholder")} value={query} onChange={setTreeQuery} />;
};

export const HeaderActions = () => {
  const { t } = useI18n("statuses");

  const ALL_TAB = "total";

  return (
    <div className={styles.headerActions}>
      <div className={styles["header-search"]}>
        <Search />
        <Filters />
      </div>
      <div className={styles["header-filters"]}>
        <div className={styles["header-tabs"]}>
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
        </div>
        <SortBy />
      </div>
    </div>
  );
};
