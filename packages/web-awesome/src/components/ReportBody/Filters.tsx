import { Button, allureIcons } from "@allurereport/web-components";
import { Menu } from "@allurereport/web-components";
import { Toggle } from "@allurereport/web-components";
import { useI18n } from "@/stores/locale";
import { setTreeFilter, treeFiltersStore } from "@/stores/tree";
import * as styles from "./styles.scss";

export const Filters = () => {
  const { t } = useI18n("filters");
  const { flaky, retry, new: isNew } = treeFiltersStore.value.filter;
  const hasFilter = flaky || retry || isNew;

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
      <Menu.Section>
        <Menu.Item
          closeMenuOnClick={false}
          ariaLabel={t("enable-filter", { filter: t("flaky") })}
          onClick={() => {
            setTreeFilter("flaky", !flaky);
          }}
          leadingIcon={allureIcons.lineGeneralZap}
          rightSlot={
            <div className={styles.filterToggle}>
              <Toggle
                focusable={false}
                value={flaky}
                label={t("enable-filter", { filter: t("flaky") })}
                data-testid="flaky-filter"
                onChange={(value) => setTreeFilter("flaky", value)}
              />
            </div>
          }
        >
          {t("flaky")}
        </Menu.Item>
        <Menu.Item
          closeMenuOnClick={false}
          ariaLabel={t("enable-filter", { filter: t("retry") })}
          onClick={() => setTreeFilter("retry", !retry)}
          leadingIcon={allureIcons.lineArrowsRefreshCcw1}
          rightSlot={
            <div className={styles.filterToggle}>
              <Toggle
                focusable={false}
                value={retry}
                label={t("enable-filter", { filter: t("retry") })}
                data-testid="retry-filter"
                onChange={(value) => setTreeFilter("retry", value)}
              />
            </div>
          }
        >
          {t("retry")}
        </Menu.Item>
        <Menu.Item
          closeMenuOnClick={false}
          ariaLabel={t("enable-filter", { filter: t("new") })}
          onClick={() => setTreeFilter("new", !isNew)}
          leadingIcon={allureIcons.lineAlertsNotificationBox}
          rightSlot={
            <div className={styles.filterToggle}>
              <Toggle
                focusable={false}
                value={isNew}
                label={t("enable-filter", { filter: t("new") })}
                data-testid="new-filter"
                onChange={(value) => setTreeFilter("new", value)}
              />
            </div>
          }
        >
          {t("new")}
        </Menu.Item>
      </Menu.Section>
    </Menu>
  );
};
