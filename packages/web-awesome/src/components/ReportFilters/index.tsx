import { For } from "@preact/signals/utils";
import { quickAwesomeFilters, setAwesomeFilter } from "@/stores/reportFilters/store";
import type {
  AwesomeArrayFieldFilter,
  AwesomeBooleanFieldFilter,
  AwesomeFilter,
  AwesomeFilterGroupSimple,
} from "../../stores/reportFilters/model";
import { BooleanFieldFilter } from "./BaseFilters";
import { RetryFlakyFilter } from "./RetryFlaky";
import { TagsFilter } from "./TagsFilter";
import { TransitionFilter } from "./TransitionFilter";
import * as styles from "./styles.scss";

const isRetryFilter = (filter: AwesomeFilter): filter is AwesomeBooleanFieldFilter => {
  return filter.type === "field" && filter.value.type === "boolean" && filter.value.key === "retry";
};

const isFlakyFilter = (filter: AwesomeFilter): filter is AwesomeBooleanFieldFilter => {
  return filter.type === "field" && filter.value.type === "boolean" && filter.value.key === "flaky";
};

const isTagFilter = (filter: AwesomeFilter): filter is AwesomeArrayFieldFilter => {
  return filter.type === "field" && filter.value.type === "array" && filter.value.key === "tags";
};

const isTransitionFilter = (filter: AwesomeFilter): filter is AwesomeFilterGroupSimple => {
  return filter.type === "group" && filter.fieldKey === "transition";
};

const Filter = (props: { filter: AwesomeFilter; onChange: (filter: AwesomeFilter) => void }) => {
  const { filter, onChange } = props;
  const { value: field, type } = filter;

  if (isRetryFilter(filter) || isFlakyFilter(filter)) {
    return <RetryFlakyFilter filter={filter} onChange={onChange} />;
  }

  if (isTransitionFilter(filter)) {
    return <TransitionFilter group={filter} onChange={onChange} />;
  }

  if (type === "field" && field.type === "boolean") {
    return <BooleanFieldFilter field={field} onChange={(value) => onChange({ ...filter, value })} />;
  }

  if (isTagFilter(filter)) {
    return <TagsFilter filter={filter} onChange={onChange} />;
  }

  return null;
};

const QuickFilters = () => {
  return <For each={quickAwesomeFilters}>{(filter) => <Filter filter={filter} onChange={setAwesomeFilter} />}</For>;
};

export const ReportFilters = () => {
  return (
    <div className={styles.wrapper}>
      <QuickFilters />
    </div>
  );
};
