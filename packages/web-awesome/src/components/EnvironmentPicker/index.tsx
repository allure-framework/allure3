import { currentEnvironment, environmentsStore, setCurrentEnvironment } from "@allurereport/web-commons";
import { DropdownButton, Menu, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { computed } from "@preact/signals";
import { For } from "@preact/signals/utils";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

const availableEnvironments = computed(() => environmentsStore.value.data.value);
const noAvailableEnvironments = computed(() => availableEnvironments.value.length <= 1);

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export const EnvironmentPicker = () => {
  const { t } = useI18n("environments");
  const environment = currentEnvironment.value;
  const handleSelect = (selectedOption: string) => {
    setCurrentEnvironment(selectedOption);
  };

  if (noAvailableEnvironments.value) {
    return null;
  }

  return (
    <div className={styles["environment-picker"]} data-testid={"environment-picker"}>
      <SvgIcon id={allureIcons.environment} size={"s"} />
      <Text className={styles["environment-picker-label"]} type={"ui"} size={"s"} bold>
        {t("environment", { count: 1 })}:
      </Text>
      <Menu
        size="s"
        menuTrigger={({ isOpened, onClick }) => (
          <DropdownButton
            style="ghost"
            size="s"
            text={environment || t("all")}
            isExpanded={isOpened}
            data-testid={"environment-picker-button"}
            onClick={onClick}
          />
        )}
      >
        <Menu.Section>
          <Menu.ItemWithCheckmark
            data-testid={"environment-picker-item"}
            onClick={() => handleSelect("")}
            isChecked={!environment}
          >
            {t("all")}
          </Menu.ItemWithCheckmark>
          <For each={availableEnvironments}>
            {(env) => (
              <Menu.ItemWithCheckmark
                data-testid={"environment-picker-item"}
                onClick={() => handleSelect(env)}
                key={env}
                isChecked={env === environment}
              >
                {env}
              </Menu.ItemWithCheckmark>
            )}
          </For>
        </Menu.Section>
      </Menu>
    </div>
  );
};
