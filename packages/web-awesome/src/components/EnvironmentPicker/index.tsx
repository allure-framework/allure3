import { DropdownButton, Menu, allureIcons } from "@allurereport/web-components";
import { currentEnvironment, environments, setCurrentEnvironment } from "@/stores/env";

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export const EnvironmentPicker = () => {
  const environment = currentEnvironment.value;
  const handleSelect = (selectedOption: string) => {
    setCurrentEnvironment(selectedOption);
  };

  // TODO: use props instead
  if (environments.value.data.length <= 1) {
    return null;
  }

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          icon={allureIcons.view}
          style="ghost"
          size="s"
          // text={LANG_LOCALE[environment || "en"].short}
          text={environment ?? "All"}
          isExpanded={isOpened}
          onClick={onClick}
        />
      )}
    >
      <Menu.Section>
        <Menu.ItemWithCheckmark onClick={() => handleSelect(undefined)} isChecked={!environment}>
          All
        </Menu.ItemWithCheckmark>
        {environments.value.data.map((env) => (
          <Menu.ItemWithCheckmark onClick={() => handleSelect(env)} key={env} isChecked={env === environment}>
            {env}
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
