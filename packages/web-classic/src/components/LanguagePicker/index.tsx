import { Button, DropdownButton, Menu } from "@allurereport/web-components";
import { LANG_LOCALE, type LangLocale } from "@/i18n/constants";
import { currentLocale } from "@/stores";
import { setLocale } from "@/stores/locale";
import * as styles from "./styles.scss";

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const langPickerOptions = Object.entries(LANG_LOCALE).map(([key, { full }]) => ({
  key: key as LangLocale,
  value: full,
}));

export const LanguagePicker = () => {
  const locale = currentLocale.value;
  const handleSelect = (selectedOption: LangLocale) => {
    setLocale(selectedOption);
  };

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <Button
          style="flat"
          className={styles["language-picker"]}
          size="m"
          text={LANG_LOCALE[locale || "en"].short}
          isExpanded={isOpened}
          onClick={onClick}
        />
      )}
    >
      <Menu.Section>
        {langPickerOptions.map(({ key, value }) => (
          <Menu.ItemWithCheckmark onClick={() => handleSelect(key)} key={key} isChecked={locale === key}>
            {value}
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
