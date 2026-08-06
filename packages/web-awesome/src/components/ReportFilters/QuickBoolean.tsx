import { allureIcons } from "@allurereport/web-components";

import { useI18n } from "@/stores";
import type { AwesomeBooleanFieldFilterByKey } from "@/stores/treeFilters/model";

import { BooleanFieldFilter } from "./BaseFilters";

type QuickBooleanFilterKey = "flaky" | "known" | "retry";

const icons: Record<QuickBooleanFilterKey, string> = {
  flaky: allureIcons.lineIconBomb2,
  known: allureIcons.lineKnownIssues,
  retry: allureIcons.lineArrowsRefreshCcw1,
};

type QuickBooleanFieldFilter = AwesomeBooleanFieldFilterByKey<QuickBooleanFilterKey>;

export const QuickBooleanFilter = (props: {
  filter: QuickBooleanFieldFilter;
  onChange: (filter: QuickBooleanFieldFilter) => void;
}) => {
  const { filter, onChange } = props;
  const { value: field } = filter;
  const { key } = field;
  const { t, t: tDescription } = useI18n("filters");

  return (
    <BooleanFieldFilter
      field={field}
      onChange={(value) => onChange({ ...filter, value })}
      icon={icons[key]}
      label={t(key)}
      testId={`${key}-filter`}
      description={tDescription(`description.${key}`)}
    />
  );
};
