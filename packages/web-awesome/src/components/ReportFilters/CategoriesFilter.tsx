import { computed } from "@preact/signals";
import { useI18n } from "@/stores";
import { treeCategories } from "@/stores/treeFilters/store";
import type { AwesomeArrayFieldFilter } from "../../stores/treeFilters/model";
import { ArrayFieldFilter } from "./BaseFilters";

const options = computed(() => {
  return treeCategories.value.map((category) => ({ key: category, label: category }));
});

export const CategoriesFilter = (props: {
  filter: AwesomeArrayFieldFilter;
  onChange: (filter: AwesomeArrayFieldFilter) => void;
}) => {
  const { filter, onChange } = props;
  const { t } = useI18n("filters");

  if (options.value.length === 0) {
    return null;
  }

  return (
    <ArrayFieldFilter
      filter={filter}
      onChange={onChange}
      options={options.value}
      label={t("categories")}
      description={t("description.categories")}
      counter
      onClear={() =>
        onChange({
          ...filter,
          value: {
            ...filter.value,
            value: [],
          },
        })
      }
    />
  );
};
