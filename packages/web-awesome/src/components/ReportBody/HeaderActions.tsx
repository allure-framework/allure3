import { SearchBox } from "@allurereport/web-components";
import { TreeToggle } from "@/components/ReportBody/TreeToggle";
import { useI18n } from "@/stores/locale";
import { setTreeQuery } from "@/stores/tree";
import { treeFiltersStore } from "@/stores/treeFilters";
import { Filters } from "./Filters";
import * as styles from "./styles.scss";

const Search = () => {
  const { query } = treeFiltersStore.value;
  const { t } = useI18n("search");

  return <SearchBox placeholder={t("search-placeholder")} value={query} onChange={setTreeQuery} />;
};

export const HeaderActions = () => {
  return (
    <div className={styles.headerActions}>
      <TreeToggle />
      <Search />
      <Filters />
    </div>
  );
};
