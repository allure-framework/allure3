import { SearchBox } from "@allurereport/web-components";
import { useI18n } from "@/stores/locale";
import { queryAwesomeFilterValue, setQueryAwesomeFilter } from "@/stores/reportFilters/store";

const handleQuerySearch = (value: string) => {
  if (!value) {
    setQueryAwesomeFilter(undefined);
    return;
  }

  setQueryAwesomeFilter(value);
};

const QuerySearch = () => {
  const { t } = useI18n("search");

  return (
    <SearchBox
      placeholder={t("search-placeholder")}
      value={queryAwesomeFilterValue.value}
      onChange={handleQuerySearch}
      changeDebounce={150}
    />
  );
};

export const ReportSearch = () => {
  return <QuerySearch />;
};
