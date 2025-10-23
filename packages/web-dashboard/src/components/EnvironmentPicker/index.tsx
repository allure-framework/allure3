import { DropdownButton, Menu, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { currentEnvironment, environmentsStore, setCurrentEnvironment } from "@/stores/env";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export const EnvironmentPicker = () => {
  const { t } = useI18n("environments");
  const environment = currentEnvironment.value;
  const handleSelect = (selectedOption: string) => {
    setCurrentEnvironment(selectedOption);
  };

  // TODO: use props instead
  if (environmentsStore.value.data.length <= 1) {
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
          <Menu.ItemWithCheckmark onClick={() => handleSelect("")} isChecked={!environment}>
            {t("all")}
          </Menu.ItemWithCheckmark>
          {environmentsStore.value.data.map((env) => (
            <Menu.ItemWithCheckmark onClick={() => handleSelect(env)} key={env} isChecked={env === environment}>
              {env}
            </Menu.ItemWithCheckmark>
          ))}
        </Menu.Section>
      </Menu>
    </div>
  );
};
