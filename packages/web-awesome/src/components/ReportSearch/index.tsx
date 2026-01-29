import { SearchBox } from "@allurereport/web-components";
import { useI18n } from "@/stores/locale";
import { setTreeQueryFilter, treeQueryFilterValue } from "@/stores/treeFilters/store";

const handleQuerySearch = (value: string) => {
  if (!value) {
    setTreeQueryFilter(undefined);
    return;
  }

  setTreeQueryFilter(value);
};

const QuerySearch = () => {
  const { t } = useI18n("search");

  return (
    <SearchBox
      placeholder={t("search-placeholder")}
      value={treeQueryFilterValue.value}
      onChange={handleQuerySearch}
      changeDebounce={150}
    />
  );
};

export const ReportSearch = () => {
  return <QuerySearch />;
};
