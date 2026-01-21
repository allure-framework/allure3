import { computed } from "@preact/signals";
import { useI18n } from "@/stores";
import { allTreeTags } from "@/stores/tree";
import type { AwesomeArrayFieldFilter } from "../../stores/reportFilters/model";
import { ArrayFieldFilter } from "./BaseFilters";

const options = computed(() => {
  return allTreeTags.value.map((tag) => ({ key: tag, label: tag }));
});

export const TagsFilter = (props: {
  filter: AwesomeArrayFieldFilter;
  onChange: (filter: AwesomeArrayFieldFilter) => void;
}) => {
  const { filter, onChange } = props;
  const { t } = useI18n("filters");

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
