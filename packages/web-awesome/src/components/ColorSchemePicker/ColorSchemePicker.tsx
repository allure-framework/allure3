import { DropdownButton, Menu } from "@allurereport/web-components";

import { THEME_FAMILIES, selectedFamily, setThemeFamily } from "@/stores/colorScheme";

import { ColorSchemeItem } from "./ColorSchemeItem";

export const ColorSchemePicker = () => {
  const current = selectedFamily.value;
  const currentLabel = THEME_FAMILIES.find((f) => f.key === current)?.label ?? "Theme";

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton style="ghost" size="s" text={currentLabel} isExpanded={isOpened} onClick={onClick} />
      )}
    >
      <Menu.Section>
        {THEME_FAMILIES.map((family) => (
          <Menu.ItemWithCheckmark
            key={family.key}
            onClick={() => setThemeFamily(family.key)}
            isChecked={current === family.key}
          >
            <ColorSchemeItem option={family} />
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
