import { DropdownButton, Menu } from "@allurereport/web-components";

import { COLOR_SCHEMES, type ColorScheme, colorScheme, setColorScheme } from "@/stores/colorScheme";

import * as styles from "./styles.scss";

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
        {COLOR_SCHEMES.map(({ key, label, preview }) => (
          <Menu.ItemWithCheckmark
            key={key}
            onClick={() => setColorScheme(key as ColorScheme)}
            isChecked={current === key}
          >
            <span className={styles.item}>
              <span className={styles.swatch} style={{ background: key === "default" ? undefined : preview }} />
              {label}
            </span>
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
