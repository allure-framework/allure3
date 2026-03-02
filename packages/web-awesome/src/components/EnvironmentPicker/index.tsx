import { DropdownButton, Menu, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { useI18n } from "@/stores";
import { currentEnvironment, envDisplayNameMap, environmentsStore, setCurrentEnvironment } from "@/stores/env";
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

  const envDisplayName = environment
    ? envDisplayNameMap.value[environment] ?? environment
    : t("all");

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
            text={envDisplayName}
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
          {environmentsStore.value.data.map((env) => (
            <Menu.ItemWithCheckmark
              data-testid={"environment-picker-item"}
              onClick={() => handleSelect(env.id)}
              key={env.id}
              isChecked={env.id === environment}
            >
              {env.name}
            </Menu.ItemWithCheckmark>
          ))}
        </Menu.Section>
      </Menu>
    </div>
  );
};
