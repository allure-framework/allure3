import { SearchBox } from "@allurereport/web-components";

import { useI18n } from "@/stores/locale";
import { setTreeQueryFilter, treeFiltersResetNonce, treeQueryFilterValue } from "@/stores/treeFilters/store";

const handleQuerySearch = (value: string) => {
  if (!value) {
    setTreeQueryFilter(undefined);
    return;
  }

  setTreeQueryFilter(value);
};

export const ReportSearch = () => {
  const { t } = useI18n("search");

  return (
    <SearchBox
      key={treeFiltersResetNonce.value}
      placeholder={t("search-placeholder")}
      value={treeQueryFilterValue.value ?? ""}
      onChange={handleQuerySearch}
      changeDebounce={150}
    />
  );
};
