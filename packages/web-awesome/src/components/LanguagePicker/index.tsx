import { DropdownButton } from "@allurereport/web-components";
import { Menu } from "@allurereport/web-components";
import { LANG_LOCALE, type LangLocale } from "@/i18n/constants";
import { currentLocale } from "@/stores";
import { setLocale } from "@/stores/locale";

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
        <DropdownButton
          style="ghost"
          size="s"
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
