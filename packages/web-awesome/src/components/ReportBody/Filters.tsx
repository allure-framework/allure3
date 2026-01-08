import { Button, Menu, Toggle, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { computed } from "@preact/signals";
import { For } from "@preact/signals/utils";
import { useEffect } from "preact/hooks";
import { useI18n } from "@/stores/locale";
import {
  type TreeFilters,
  setFilters,
  setTestTypeFilter,
  setTransitionFilter,
  testTypeFilters,
  transitionFilters,
} from "@/stores/treeFilters";
import { filtersList } from "@/stores/treeFilters/constants";
import * as styles from "./styles.scss";

const filterIcons: Record<TreeFilters, string> = {
  flaky: allureIcons.lineIconBomb2,
  retry: allureIcons.lineArrowsRefreshCcw1,
  new: allureIcons.lineAlertsNew,
  fixed: allureIcons.lineAlertsFixed,
  regressed: allureIcons.lineAlertsRegressed,
  malfunctioned: allureIcons.lineAlertsMalfunctioned,
};

const FilterItem = (props: { filter: TreeFilters; value: boolean; onChange: (value: boolean) => void }) => {
  const { filter, value, onChange } = props;
  const { t: tooltip } = useI18n("filters.description");
  const { t } = useI18n("filters");

  return (
    <TooltipWrapper data-testid="filter-tooltip" tooltipText={tooltip(filter)}>
      <Menu.Item
        closeMenuOnClick={false}
        ariaLabel={t("enable-filter", { filter: t(filter) })}
        onClick={() => onChange(!value)}
        leadingIcon={filterIcons[filter]}
        rightSlot={
          <div className={styles.filterToggle}>
            <Toggle
              focusable={false}
              value={value}
              label={t("enable-filter", { filter: t(filter) })}
              data-testid={`${filter}-filter`}
              onChange={(changeValue) => onChange(changeValue)}
            />
          </div>
        }
      >
        {t(filter)}
      </Menu.Item>
    </TooltipWrapper>
  );
};

const hasFilter = computed(
  () => transitionFilters.value.some(([, value]) => value) || testTypeFilters.value.some(([, value]) => value),
);

export const Filters = () => {
  const { t } = useI18n("filters");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filtersParams = params.getAll("filter");

    if (filtersParams.length > 0) {
      const activeFilters = filtersList.reduce(
        (acc, key) => ({
          ...acc,
          [key]: filtersParams.includes(key),
        }),
        {} as Record<string, boolean>,
      );

      setFilters(activeFilters);
    }
  }, []);

  return (
    <Menu
      menuTrigger={({ isOpened, onClick }) => (
        <div className={hasFilter.value && styles.filtersBtnWithFilters}>
          <Button
            icon={allureIcons.lineGeneralSettings1}
            text={t("more-filters")}
            size="m"
            style="outline"
            isActive={isOpened}
            data-testid="filters-button"
            onClick={onClick}
          />
        </div>
      )}
    >
      <Menu.Section>
        <For each={testTypeFilters}>
          {([filter, value]) => (
            <FilterItem
              key={filter}
              filter={filter}
              value={value}
              onChange={(newValue) => setTestTypeFilter(filter, newValue)}
            />
          )}
        </For>
      </Menu.Section>
      <Menu.Section data-testid="filters-menu">
        <For each={transitionFilters}>
          {([filter, value]) => (
            <FilterItem
              key={filter}
              filter={filter}
              value={value}
              onChange={(newValue) => setTransitionFilter(filter, newValue)}
            />
          )}
        </For>
      </Menu.Section>
    </Menu>
  );
};
