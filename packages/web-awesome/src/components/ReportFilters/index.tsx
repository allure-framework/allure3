import { For } from "@preact/signals/utils";
import type { AwesomeFilter } from "@/stores/treeFilters/model";
import { setTreeFilter, treeQuickFilters } from "@/stores/treeFilters/store";
import { isFlakyFilter, isRetryFilter, isTagFilter, isTransitionFilter } from "@/stores/treeFilters/utils";
import { BooleanFieldFilter } from "./BaseFilters";
import { RetryFlakyFilter } from "./RetryFlaky";
import { TagsFilter } from "./TagsFilter";
import { TransitionFilter } from "./TransitionFilter";
import * as styles from "./styles.scss";

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
  return <For each={treeQuickFilters}>{(filter) => <Filter filter={filter} onChange={setTreeFilter} />}</For>;
};

export const ReportFilters = () => {
  return (
    <div className={styles.wrapper}>
      <QuickFilters />
    </div>
  );
};
