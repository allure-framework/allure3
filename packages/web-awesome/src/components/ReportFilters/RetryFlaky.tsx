import { allureIcons } from "@allurereport/web-components";
import { useI18n } from "@/stores";
import type { AwesomeBooleanField, AwesomeFieldFilter } from "@/stores/treeFilters/model";
import { BooleanFieldFilter } from "./BaseFilters";

type RetryOrFlakyFilter = AwesomeFieldFilter & {
  value: AwesomeBooleanField;
};

export const RetryFlakyFilter = (props: {
  filter: RetryOrFlakyFilter;
  onChange: (filter: RetryOrFlakyFilter) => void;
}) => {
  const { filter, onChange } = props;
  const { value: field } = filter;
  const { key } = field;
  const { t, t: tDescription } = useI18n("filters");

  return (
    <BooleanFieldFilter
      field={field}
      onChange={(value) => onChange({ ...filter, value })}
      icon={key === "retry" ? allureIcons.lineArrowsRefreshCcw1 : allureIcons.lineIconBomb2}
      label={t(key)}
      testId={`${key}-filter`}
      description={tDescription(`description.${key}`)}
    />
  );
};
