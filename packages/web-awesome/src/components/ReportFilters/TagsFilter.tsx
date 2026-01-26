import { computed } from "@preact/signals";
import { useI18n } from "@/stores";
import { treeTags } from "@/stores/treeFilters/store";
import type { AwesomeArrayFieldFilter } from "../../stores/treeFilters/model";
import { ArrayFieldFilter } from "./BaseFilters";

const options = computed(() => {
  return treeTags.value.map((tag) => ({ key: tag, label: tag }));
});

export const TagsFilter = (props: {
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
      label={t("tags")}
      description={t("description.tags")}
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
