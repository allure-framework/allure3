import { Button, Menu } from "@allurereport/web-components";
import { currentLocale } from "@/stores";
import { setLocale } from "@/stores/locale";
import { LANG_LOCALE, type LangLocale } from "@/translations/constants";
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
      menuTrigger={({ onClick }) => (
        <Button
          style="raised"
          className={styles["language-picker"]}
          size="s"
          text={LANG_LOCALE[locale || "en"].short}
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
