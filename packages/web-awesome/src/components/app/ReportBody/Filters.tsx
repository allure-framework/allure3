import notificationBoxIcon from "@/assets/svg/line-alerts-notification-box.svg";
import refreshIcon from "@/assets/svg/line-arrows-refresh-ccw-1.svg";
import settingsIcon from "@/assets/svg/line-general-settings-1.svg";
import zapIcon from "@/assets/svg/line-general-zap.svg";
import { Button } from "@/components/commons/Button";
import { Menu } from "@/components/commons/Menu";
import { Toggle } from "@/components/commons/Toggle";
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
            icon={settingsIcon.id}
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
          leadingIcon={zapIcon.id}
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
          leadingIcon={refreshIcon.id}
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
          leadingIcon={notificationBoxIcon.id}
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
