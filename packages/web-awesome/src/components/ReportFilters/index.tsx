import { Button } from "@allurereport/web-components";
import { For } from "@preact/signals/utils";

import { useI18n } from "@/stores/locale";
import type { AwesomeFilter } from "@/stores/treeFilters/model";
import { clearTreeFilters, hasActiveTreeFilters, setTreeFilter, treeQuickFilters } from "@/stores/treeFilters/store";
import {
  isCategoryFilter,
  isFlakyFilter,
  isResolutionFilter,
  isRetryFilter,
  isTagFilter,
  isTransitionFilter,
} from "@/stores/treeFilters/utils";

import { BooleanFieldFilter } from "./BaseFilters";
import { CategoriesFilter } from "./CategoriesFilter";
import { ResolutionFilter } from "./ResolutionFilter";
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

  if (isResolutionFilter(filter)) {
    return <ResolutionFilter group={filter} onChange={onChange} />;
  }

  if (type === "field" && field.type === "boolean") {
    return <BooleanFieldFilter field={field} onChange={(value) => onChange({ ...filter, value })} />;
  }

  if (isTagFilter(filter)) {
    return <TagsFilter filter={filter} onChange={onChange} />;
  }

  if (isCategoryFilter(filter)) {
    return <CategoriesFilter filter={filter} onChange={onChange} />;
  }

  return null;
};

const QuickFilters = () => {
  return <For each={treeQuickFilters}>{(filter) => <Filter filter={filter} onChange={setTreeFilter} />}</For>;
};

const ClearFiltersButton = () => {
  const { t } = useI18n("empty");

  if (!hasActiveTreeFilters.value) {
    return null;
  }

  return <Button type="button" text={t("clear-filters")} size="s" style="outline" onClick={() => clearTreeFilters()} />;
};

export const ReportFilters = () => {
  return (
    <div className={styles.wrapper}>
      <QuickFilters />
      <ClearFiltersButton />
    </div>
  );
};
