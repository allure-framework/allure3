import { DropdownButton, Menu } from "@allurereport/web-components";

import { COLOR_SCHEMES, colorScheme, setColorScheme } from "@/stores/colorScheme";

import { ColorSchemeItem } from "./ColorSchemeItem";

export const ColorSchemePicker = () => {
  const current = colorScheme.value;
  const currentLabel = COLOR_SCHEMES.find((s) => s.key === current)?.label ?? "Theme";

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton style="ghost" size="s" text={currentLabel} isExpanded={isOpened} onClick={onClick} />
      )}
    >
      <Menu.Section>
        {COLOR_SCHEMES.map((option) => (
          <Menu.ItemWithCheckmark
            key={option.key}
            onClick={() => setColorScheme(option.key)}
            isChecked={current === option.key}
          >
            <ColorSchemeItem option={option} />
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
