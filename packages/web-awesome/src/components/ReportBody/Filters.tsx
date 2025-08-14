import { Button, Menu, Toggle, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { useI18n } from "@/stores/locale";
import { type TreeFilters, setTreeFilter, treeFiltersStore } from "@/stores/tree";
import * as styles from "./styles.scss";

const filterIcons: Record<TreeFilters, string> = {
  flaky: allureIcons.lineIconBomb2,
  retry: allureIcons.lineArrowsRefreshCcw1,
  new: allureIcons.lineAlertsNew,
  fixed: allureIcons.lineAlertsFixed,
  regressed: allureIcons.lineAlertsRegressed,
  malfunctioned: allureIcons.lineAlertsMalfunctioned,
};

const MENU_KEYS = ["flaky", "retry", "new", "fixed", "regressed", "malfunctioned"] as TreeFilters[];

export const Filters = () => {
  const { t } = useI18n("filters");
  const { t: tooltip } = useI18n("filters.description");
  const hasFilter = MENU_KEYS.some((key) => treeFiltersStore.value.filter[key]);

  const renderFilterItem = (filter: TreeFilters, value: boolean) => {
    return (
      <TooltipWrapper data-testid="filter-tooltip" tooltipText={tooltip(filter)}>
        <Menu.Item
          closeMenuOnClick={false}
          ariaLabel={t("enable-filter", { filter: t(filter) })}
          onClick={() => {
            setTreeFilter(filter, !value);
          }}
          leadingIcon={filterIcons[filter]}
          rightSlot={
            <div className={styles.filterToggle}>
              <Toggle
                focusable={false}
                value={value}
                label={t("enable-filter", { filter: t(filter) })}
                data-testid={`${filter}-filter`}
                onChange={(changeValue) => setTreeFilter(filter, changeValue)}
              />
            </div>
          }
        >
          {t(filter)}
        </Menu.Item>
      </TooltipWrapper>
    );
  };

  return (
    <Menu
      menuTrigger={({ isOpened, onClick }) => (
        <div className={hasFilter && styles.filtersBtnWithFilters}>
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
      <Menu.Section data-testid="filters-menu">
        {MENU_KEYS.map((key: TreeFilters) => renderFilterItem(key, treeFiltersStore.value.filter[key]))}
      </Menu.Section>
    </Menu>
  );
};
