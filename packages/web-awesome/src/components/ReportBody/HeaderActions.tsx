import { SearchBox } from "@allurereport/web-components";
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
  return (
    <div className={styles.headerActions}>
      <Search />
      <Filters />
    </div>
  );
};
